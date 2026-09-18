"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { all, newId, nowIso, run } from "../db";
import { todayIso } from "../dates";
import { getVehicle } from "../queries";
import { deleteUploadFile } from "../uploads";
import {
  enums,
  optionalDate,
  parse,
  requiredDate,
  requiredText,
  toFormState,
  ValidationError,
  type FormState,
} from "./shared";

interface VehicleFields {
  nickname: string | null;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  vehicle_type: string;
  vin: string | null;
  plate: string | null;
  color: string | null;
  purchased_on: string | null;
  purchase_price_cents: number | null;
  tracks_mileage: number;
  tracks_engine_hours: number;
  notes: string | null;
}

const VEHICLE_COLUMNS: Array<keyof VehicleFields> = [
  "nickname",
  "year",
  "make",
  "model",
  "trim",
  "vehicle_type",
  "vin",
  "plate",
  "color",
  "purchased_on",
  "purchase_price_cents",
  "tracks_mileage",
  "tracks_engine_hours",
  "notes",
];

function vehicleFieldsFrom(formData: FormData): VehicleFields {
  const year = parse.int(formData.get("year"));
  if (year != null && (year < 1885 || year > 2100)) {
    throw new ValidationError("Enter a realistic model year.");
  }

  const fields: VehicleFields = {
    nickname: parse.text(formData.get("nickname")),
    year,
    make: requiredText(formData.get("make"), "Make"),
    model: requiredText(formData.get("model"), "Model"),
    trim: parse.text(formData.get("trim")),
    vehicle_type: enums.vehicleType(formData.get("vehicle_type")),
    vin: parse.text(formData.get("vin")),
    plate: parse.text(formData.get("plate")),
    color: parse.text(formData.get("color")),
    purchased_on: optionalDate(formData.get("purchased_on"), "Purchase date"),
    purchase_price_cents: parse.money(formData.get("purchase_price")),
    tracks_mileage: parse.flag(formData.get("tracks_mileage")),
    tracks_engine_hours: parse.flag(formData.get("tracks_engine_hours")),
    notes: parse.text(formData.get("notes")),
  };

  if (!fields.tracks_mileage && !fields.tracks_engine_hours) {
    throw new ValidationError("Track at least one meter: mileage, engine hours, or both.");
  }

  return fields;
}

export async function createVehicleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let vehicleId: string;

  try {
    const fields = vehicleFieldsFrom(formData);
    const mileage = parse.int(formData.get("current_mileage"));
    const hours = parse.float(formData.get("current_engine_hours"));

    vehicleId = newId("veh");
    const timestamp = nowIso();

    await run(
      `INSERT INTO vehicle (id, ${VEHICLE_COLUMNS.join(", ")},
                            current_mileage, current_engine_hours, usage_updated_on, archived, created_at, updated_at)
       VALUES (@id, ${VEHICLE_COLUMNS.map((column) => `@${column}`).join(", ")},
               @current_mileage, @current_engine_hours, @usage_updated_on, 0, @created_at, @updated_at)`,
      {
      ...fields,
      id: vehicleId,
      current_mileage: mileage,
      current_engine_hours: hours,
        usage_updated_on: mileage != null || hours != null ? todayIso() : null,
        created_at: timestamp,
        updated_at: timestamp,
      },
    );

    if (mileage != null || hours != null) {
      await run(
        `INSERT INTO usage_reading (id, vehicle_id, recorded_on, mileage, engine_hours, source, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'INITIAL', NULL, ?)`,
        [newId("usg"), vehicleId, todayIso(), mileage, hours, timestamp],
      );
    }
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/");
  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicleId}`);
}

export async function updateVehicleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!(await getVehicle(vehicleId))) return { error: "That vehicle no longer exists." };

  try {
    await run(
      `UPDATE vehicle SET ${VEHICLE_COLUMNS.map((column) => `${column} = @${column}`).join(", ")}, updated_at = @updated_at
        WHERE id = @id`,
      { ...vehicleFieldsFrom(formData), id: vehicleId, updated_at: nowIso() },
    );
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`, "layout");
  redirect(`/vehicles/${vehicleId}`);
}

/**
 * Records a new odometer / hour-meter reading. Every maintenance calculation on
 * the vehicle keys off these numbers, so each one is kept as history too.
 */
export async function recordUsageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) return { error: "That vehicle no longer exists." };

  try {
    const recordedOn = requiredDate(formData.get("recorded_on"), "Reading date");
    const mileage = parse.int(formData.get("mileage"));
    const engineHours = parse.float(formData.get("engine_hours"));

    if (mileage == null && engineHours == null) {
      throw new ValidationError("Enter a mileage or an engine-hour reading.");
    }

    const timestamp = nowIso();
    await run(
      `INSERT INTO usage_reading (id, vehicle_id, recorded_on, mileage, engine_hours, source, notes, created_at)
       VALUES (?, ?, ?, ?, ?, 'MANUAL', ?, ?)`,
      [newId("usg"), vehicleId, recordedOn, mileage, engineHours, parse.text(formData.get("notes")), timestamp],
    );

    // The reading is authoritative when it is the most recent one on file.
    const isLatest = vehicle.usage_updated_on == null || recordedOn >= vehicle.usage_updated_on;
    if (isLatest) {
      await run(
        `UPDATE vehicle
            SET current_mileage = COALESCE(?, current_mileage),
                current_engine_hours = COALESCE(?, current_engine_hours),
                usage_updated_on = ?, updated_at = ?
          WHERE id = ?`,
        [mileage, engineHours, recordedOn, timestamp, vehicleId],
      );
    }
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath(`/vehicles/${vehicleId}`, "layout");
  return { ok: true };
}

export async function setVehicleArchivedAction(formData: FormData): Promise<void> {
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) return;

  await run(`UPDATE vehicle SET archived = ?, updated_at = ? WHERE id = ?`, [
    vehicle.archived === 1 ? 0 : 1,
    nowIso(),
    vehicleId,
  ]);

  revalidatePath("/");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`, "layout");
}

export async function deleteVehicleAction(formData: FormData): Promise<void> {
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  if (!(await getVehicle(vehicleId))) return;

  const attachments = await all<{ stored_name: string }>(
    `SELECT stored_name FROM attachment
      WHERE vehicle_id = ?
         OR part_id IN (SELECT id FROM part WHERE vehicle_id = ?)`,
    [vehicleId, vehicleId],
  );

  await run(`DELETE FROM vehicle WHERE id = ?`, [vehicleId]);
  await Promise.all(attachments.map((row) => deleteUploadFile(row.stored_name)));

  revalidatePath("/");
  revalidatePath("/vehicles");
  redirect("/vehicles");
}
