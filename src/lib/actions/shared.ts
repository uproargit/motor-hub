import "server-only";

import { db, newId, nowIso } from "../db";
import { isValidIsoDate, todayIso } from "../dates";
import {
  ATTACHMENT_KINDS,
  DISPOSITIONS,
  INSTALLED_BY,
  PART_CATEGORIES,
  PART_STATUSES,
  TASK_TYPES,
  VEHICLE_TYPES,
  WARRANTY_TYPES,
  type AttachmentKind,
  type Disposition,
  type InstalledBy,
  type PartCategory,
  type PartStatus,
  type TaskType,
  type TriggerMode,
  type VehicleType,
  type WarrantyType,
} from "../domain";
import { parseFloatOrNull, parseIntOrNull, parseMoneyToCents, textOrNull } from "../format";
import { storeUpload, UploadError } from "../uploads";

export interface FormState {
  error?: string;
  ok?: boolean;
}

export class ValidationError extends Error {}

/** Narrows a submitted string to a known enum key, falling back to a default. */
export function pickEnum<T extends string>(
  value: FormDataEntryValue | null | undefined,
  allowed: Record<string, unknown>,
  fallback: T,
): T {
  const key = value == null ? "" : String(value);
  return key in allowed ? (key as T) : fallback;
}

export function requiredText(value: FormDataEntryValue | null | undefined, field: string): string {
  const text = textOrNull(value);
  if (!text) throw new ValidationError(`${field} is required.`);
  return text;
}

export function optionalDate(value: FormDataEntryValue | null | undefined, field: string): string | null {
  const text = textOrNull(value);
  if (text == null) return null;
  if (!isValidIsoDate(text)) throw new ValidationError(`${field} must be a valid date.`);
  return text;
}

export function requiredDate(value: FormDataEntryValue | null | undefined, field: string): string {
  const date = optionalDate(value, field);
  if (!date) throw new ValidationError(`${field} is required.`);
  return date;
}

export const enums = {
  category: (v: FormDataEntryValue | null) => pickEnum<PartCategory>(v, PART_CATEGORIES, "OTHER"),
  status: (v: FormDataEntryValue | null) => pickEnum<PartStatus>(v, PART_STATUSES, "INSTALLED"),
  installedBy: (v: FormDataEntryValue | null) => pickEnum<InstalledBy>(v, INSTALLED_BY, "SELF"),
  warranty: (v: FormDataEntryValue | null) => pickEnum<WarrantyType>(v, WARRANTY_TYPES, "NONE"),
  task: (v: FormDataEntryValue | null) => pickEnum<TaskType>(v, TASK_TYPES, "INSPECT"),
  vehicleType: (v: FormDataEntryValue | null) => pickEnum<VehicleType>(v, VEHICLE_TYPES, "CAR"),
  attachmentKind: (v: FormDataEntryValue | null) => pickEnum<AttachmentKind>(v, ATTACHMENT_KINDS, "PHOTO"),
  disposition: (v: FormDataEntryValue | null) =>
    textOrNull(v) == null ? null : pickEnum<Disposition>(v, DISPOSITIONS, "KEPT"),
  triggerMode: (v: FormDataEntryValue | null): TriggerMode => (String(v) === "LAST" ? "LAST" : "FIRST"),
};

export const parse = {
  text: textOrNull,
  int: parseIntOrNull,
  float: parseFloatOrNull,
  money: parseMoneyToCents,
  flag: (value: FormDataEntryValue | null | undefined) =>
    value === "on" || value === "true" || value === "1" ? 1 : 0,
};

/**
 * Keeps the vehicle's current readings consistent with what gets recorded
 * against it: a part installed at 42 hours proves the machine has at least 42.
 */
export function bumpVehicleUsage(
  vehicleId: string,
  readings: { mileage?: number | null; engineHours?: number | null; on?: string | null; source: string },
): void {
  const vehicle = db
    .prepare<[string], { current_mileage: number | null; current_engine_hours: number | null }>(
      `SELECT current_mileage, current_engine_hours FROM vehicle WHERE id = ?`,
    )
    .get(vehicleId);
  if (!vehicle) return;

  const mileage = readings.mileage ?? null;
  const hours = readings.engineHours ?? null;
  const nextMileage = mileage != null && (vehicle.current_mileage == null || mileage > vehicle.current_mileage) ? mileage : null;
  const nextHours = hours != null && (vehicle.current_engine_hours == null || hours > vehicle.current_engine_hours) ? hours : null;

  if (nextMileage == null && nextHours == null) return;

  const on = readings.on ?? todayIso();
  db.prepare(
    `UPDATE vehicle
        SET current_mileage = COALESCE(?, current_mileage),
            current_engine_hours = COALESCE(?, current_engine_hours),
            usage_updated_on = ?,
            updated_at = ?
      WHERE id = ?`,
  ).run(nextMileage, nextHours, on, nowIso(), vehicleId);

  db.prepare(
    `INSERT INTO usage_reading (id, vehicle_id, recorded_on, mileage, engine_hours, source, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(newId("usg"), vehicleId, on, nextMileage, nextHours, readings.source, nowIso());
}

/** Persists every uploaded file on a form, ignoring empty file inputs. */
export async function saveAttachments(
  formData: FormData,
  owner: { vehicleId?: string; partId?: string; serviceRecordId?: string },
  fieldName = "files",
  kindFieldName = "file_kind",
): Promise<void> {
  const files = formData.getAll(fieldName).filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return;

  const kind = enums.attachmentKind(formData.get(kindFieldName));

  for (const file of files) {
    const stored = await storeUpload(file);
    db.prepare(
      `INSERT INTO attachment
         (id, vehicle_id, part_id, service_record_id, kind, file_name, stored_name, mime_type, size_bytes, caption, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      stored.id,
      owner.vehicleId ?? null,
      owner.partId ?? null,
      owner.serviceRecordId ?? null,
      kind,
      stored.fileName,
      stored.storedName,
      stored.mimeType,
      stored.sizeBytes,
      textOrNull(formData.get("file_caption")),
      nowIso(),
    );
  }
}

/** Turns thrown validation/upload errors into a message the form can render. */
export function toFormState(error: unknown): FormState {
  if (error instanceof ValidationError || error instanceof UploadError) {
    return { error: error.message };
  }
  throw error;
}
