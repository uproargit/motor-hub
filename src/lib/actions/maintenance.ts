"use server";

import { revalidatePath } from "next/cache";

import { db, newId, nowIso } from "../db";
import { todayIso } from "../dates";
import { getPart, getSchedule, getVehicle } from "../queries";
import { deleteUploadFile } from "../uploads";
import {
  bumpVehicleUsage,
  enums,
  optionalDate,
  parse,
  requiredDate,
  saveAttachments,
  toFormState,
  ValidationError,
  type FormState,
} from "./shared";

function revalidateVehicle(vehicleId: string): void {
  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath(`/vehicles/${vehicleId}`, "layout");
}

interface ScheduleIntervals {
  interval_miles: number | null;
  interval_hours: number | null;
  interval_months: number | null;
}

function intervalsFrom(formData: FormData): ScheduleIntervals {
  const miles = parse.int(formData.get("interval_miles"));
  const hours = parse.float(formData.get("interval_hours"));
  const months = parse.int(formData.get("interval_months"));

  const intervals = {
    interval_miles: miles && miles > 0 ? miles : null,
    interval_hours: hours && hours > 0 ? hours : null,
    interval_months: months && months > 0 ? months : null,
  };

  if (!intervals.interval_miles && !intervals.interval_hours && !intervals.interval_months) {
    throw new ValidationError("Set at least one interval: miles, engine hours or months.");
  }

  return intervals;
}

/** Attaches a maintenance schedule to an existing part. */
export async function createScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const partId = String(formData.get("part_id") ?? "");
  const part = getPart(partId);
  if (!part) return { error: "That part no longer exists." };

  try {
    const timestamp = nowIso();

    db.prepare(
      `INSERT INTO maintenance_schedule
         (id, part_id, task_type, label, interval_miles, interval_hours, interval_months,
          trigger_mode, base_mileage, base_hours, base_on, is_active, notes, created_at, updated_at)
       VALUES (@id, @part_id, @task_type, @label, @interval_miles, @interval_hours, @interval_months,
               @trigger_mode, @base_mileage, @base_hours, @base_on, 1, @notes, @created_at, @updated_at)`,
    ).run({
      ...intervalsFrom(formData),
      id: newId("sch"),
      part_id: partId,
      task_type: enums.task(formData.get("task_type")),
      label: parse.text(formData.get("label")),
      trigger_mode: enums.triggerMode(formData.get("trigger_mode")),
      // Default the baseline to the install point unless it is overridden.
      base_mileage: parse.int(formData.get("base_mileage")) ?? part.installed_mileage,
      base_hours: parse.float(formData.get("base_hours")) ?? part.installed_hours,
      base_on: optionalDate(formData.get("base_on"), "Interval start date") ?? part.installed_on ?? todayIso(),
      notes: parse.text(formData.get("notes")),
      created_at: timestamp,
      updated_at: timestamp,
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(part.vehicle_id);
  return { ok: true };
}

export async function updateScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const schedule = getSchedule(scheduleId);
  const part = schedule ? getPart(schedule.part_id) : null;
  if (!schedule || !part) return { error: "That schedule no longer exists." };

  try {
    db.prepare(
      `UPDATE maintenance_schedule
          SET task_type = @task_type, label = @label,
              interval_miles = @interval_miles, interval_hours = @interval_hours, interval_months = @interval_months,
              trigger_mode = @trigger_mode,
              base_mileage = @base_mileage, base_hours = @base_hours, base_on = @base_on,
              is_active = @is_active, notes = @notes, updated_at = @updated_at
        WHERE id = @id`,
    ).run({
      ...intervalsFrom(formData),
      id: scheduleId,
      task_type: enums.task(formData.get("task_type")),
      label: parse.text(formData.get("label")),
      trigger_mode: enums.triggerMode(formData.get("trigger_mode")),
      base_mileage: parse.int(formData.get("base_mileage")),
      base_hours: parse.float(formData.get("base_hours")),
      base_on: optionalDate(formData.get("base_on"), "Interval start date") ?? schedule.base_on,
      is_active: parse.flag(formData.get("is_active")),
      notes: parse.text(formData.get("notes")),
      updated_at: nowIso(),
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(part.vehicle_id);
  return { ok: true };
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const schedule = getSchedule(scheduleId);
  const part = schedule ? getPart(schedule.part_id) : null;
  if (!schedule || !part) return;

  db.prepare(`DELETE FROM maintenance_schedule WHERE id = ?`).run(scheduleId);
  revalidateVehicle(part.vehicle_id);
}

export async function toggleScheduleAction(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const schedule = getSchedule(scheduleId);
  const part = schedule ? getPart(schedule.part_id) : null;
  if (!schedule || !part) return;

  db.prepare(`UPDATE maintenance_schedule SET is_active = ?, updated_at = ? WHERE id = ?`).run(
    schedule.is_active === 1 ? 0 : 1,
    nowIso(),
    scheduleId,
  );
  revalidateVehicle(part.vehicle_id);
}

/**
 * Logs a completed service or inspection. When it is tied to a schedule, the
 * schedule's baseline advances to the readings at which the work was done, so
 * the next interval counts from there.
 */
export async function logServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const partId = String(formData.get("part_id") ?? "");
  const part = getPart(partId);
  if (!part) return { error: "That part no longer exists." };

  try {
    const scheduleId = parse.text(formData.get("schedule_id"));
    const schedule = scheduleId ? getSchedule(scheduleId) : null;
    if (scheduleId && (!schedule || schedule.part_id !== partId)) {
      throw new ValidationError("That schedule does not belong to this part.");
    }

    const vehicle = getVehicle(part.vehicle_id);
    const performedOn = requiredDate(formData.get("performed_on"), "Service date");
    const mileage = parse.int(formData.get("mileage"));
    const engineHours = parse.float(formData.get("engine_hours"));
    const recordId = newId("svc");
    const timestamp = nowIso();

    db.prepare(
      `INSERT INTO service_record
         (id, part_id, schedule_id, task_type, performed_on, mileage, engine_hours,
          performed_by, performer_name, cost_cents, outcome, notes, created_at)
       VALUES (@id, @part_id, @schedule_id, @task_type, @performed_on, @mileage, @engine_hours,
               @performed_by, @performer_name, @cost_cents, @outcome, @notes, @created_at)`,
    ).run({
      id: recordId,
      part_id: partId,
      schedule_id: schedule?.id ?? null,
      task_type: enums.task(formData.get("task_type")),
      performed_on: performedOn,
      mileage,
      engine_hours: engineHours,
      performed_by: enums.installedBy(formData.get("performed_by")),
      performer_name: parse.text(formData.get("performer_name")),
      cost_cents: parse.money(formData.get("cost")),
      outcome: parse.text(formData.get("outcome")),
      notes: parse.text(formData.get("notes")),
      created_at: timestamp,
    });

    if (schedule) {
      // Fall back to the vehicle's current readings so that a mileage-based
      // interval still restarts even if the reading was not typed in.
      db.prepare(
        `UPDATE maintenance_schedule
            SET base_mileage = ?, base_hours = ?, base_on = ?, updated_at = ?
          WHERE id = ?`,
      ).run(
        mileage ?? vehicle?.current_mileage ?? schedule.base_mileage,
        engineHours ?? vehicle?.current_engine_hours ?? schedule.base_hours,
        performedOn,
        timestamp,
        schedule.id,
      );
    }

    await saveAttachments(formData, { serviceRecordId: recordId });

    bumpVehicleUsage(part.vehicle_id, {
      mileage,
      engineHours,
      on: performedOn,
      source: "SERVICE",
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(part.vehicle_id);
  return { ok: true };
}

export async function deleteServiceRecordAction(formData: FormData): Promise<void> {
  const recordId = String(formData.get("service_record_id") ?? "");
  const record = db
    .prepare<[string], { part_id: string }>(`SELECT part_id FROM service_record WHERE id = ?`)
    .get(recordId);
  if (!record) return;

  const part = getPart(record.part_id);
  const attachments = db
    .prepare<[string], { stored_name: string }>(`SELECT stored_name FROM attachment WHERE service_record_id = ?`)
    .all(recordId);

  db.prepare(`DELETE FROM service_record WHERE id = ?`).run(recordId);
  await Promise.all(attachments.map((row) => deleteUploadFile(row.stored_name)));

  if (part) revalidateVehicle(part.vehicle_id);
}
