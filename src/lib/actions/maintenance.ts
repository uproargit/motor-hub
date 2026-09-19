"use server";

import { revalidatePath } from "next/cache";

import { all, newId, nowIso, one, run, txRun, writeTransaction } from "../db";
import { todayIso } from "../dates";
import { getPart, getSchedule, getVehicle } from "../queries";
import { starterSchedulesFor } from "../starter-schedules";
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
  const part = await getPart(partId);
  if (!part) return { error: "That part no longer exists." };

  try {
    const timestamp = nowIso();

    await run(
      `INSERT INTO maintenance_schedule
         (id, part_id, task_type, label, interval_miles, interval_hours, interval_months,
          trigger_mode, base_mileage, base_hours, base_on, is_active, notes, created_at, updated_at)
       VALUES (@id, @part_id, @task_type, @label, @interval_miles, @interval_hours, @interval_months,
               @trigger_mode, @base_mileage, @base_hours, @base_on, 1, @notes, @created_at, @updated_at)`,
      {
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
      },
    );
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(part.vehicle_id);
  return { ok: true };
}

export async function updateScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const schedule = await getSchedule(scheduleId);
  const part = schedule ? await getPart(schedule.part_id) : null;
  if (!schedule || !part) return { error: "That schedule no longer exists." };

  try {
    await run(
      `UPDATE maintenance_schedule
          SET task_type = @task_type, label = @label,
              interval_miles = @interval_miles, interval_hours = @interval_hours, interval_months = @interval_months,
              trigger_mode = @trigger_mode,
              base_mileage = @base_mileage, base_hours = @base_hours, base_on = @base_on,
              is_active = @is_active, notes = @notes, updated_at = @updated_at
        WHERE id = @id`,
      {
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
      },
    );
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(part.vehicle_id);
  return { ok: true };
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const schedule = await getSchedule(scheduleId);
  const part = schedule ? await getPart(schedule.part_id) : null;
  if (!schedule || !part) return;

  await run(`DELETE FROM maintenance_schedule WHERE id = ?`, [scheduleId]);
  revalidateVehicle(part.vehicle_id);
}

export async function toggleScheduleAction(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get("schedule_id") ?? "");
  const schedule = await getSchedule(scheduleId);
  const part = schedule ? await getPart(schedule.part_id) : null;
  if (!schedule || !part) return;

  await run(`UPDATE maintenance_schedule SET is_active = ?, updated_at = ? WHERE id = ?`, [
    schedule.is_active === 1 ? 0 : 1,
    nowIso(),
    scheduleId,
  ]);
  revalidateVehicle(part.vehicle_id);
}

/**
 * Logs a completed service or inspection. When it is tied to a schedule, the
 * schedule's baseline advances to the readings at which the work was done, so
 * the next interval counts from there.
 */
export async function logServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const partId = String(formData.get("part_id") ?? "");
  const part = await getPart(partId);
  if (!part) return { error: "That part no longer exists." };

  try {
    const scheduleId = parse.text(formData.get("schedule_id"));
    const schedule = scheduleId ? await getSchedule(scheduleId) : null;
    if (scheduleId && (!schedule || schedule.part_id !== partId)) {
      throw new ValidationError("That schedule does not belong to this part.");
    }

    const vehicle = await getVehicle(part.vehicle_id);
    const performedOn = requiredDate(formData.get("performed_on"), "Service date");
    const mileage = parse.int(formData.get("mileage"));
    const engineHours = parse.float(formData.get("engine_hours"));
    const recordId = newId("svc");
    const timestamp = nowIso();

    await run(
      `INSERT INTO service_record
         (id, part_id, schedule_id, task_type, performed_on, mileage, engine_hours,
          performed_by, performer_name, cost_cents, outcome, notes, created_at)
       VALUES (@id, @part_id, @schedule_id, @task_type, @performed_on, @mileage, @engine_hours,
               @performed_by, @performer_name, @cost_cents, @outcome, @notes, @created_at)`,
      {
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
      },
    );

    if (schedule) {
      // Fall back to the vehicle's current readings so that a mileage-based
      // interval still restarts even if the reading was not typed in.
      await run(
        `UPDATE maintenance_schedule
            SET base_mileage = ?, base_hours = ?, base_on = ?, updated_at = ?
          WHERE id = ?`,
        [
          mileage ?? vehicle?.current_mileage ?? schedule.base_mileage,
          engineHours ?? vehicle?.current_engine_hours ?? schedule.base_hours,
          performedOn,
          timestamp,
          schedule.id,
        ],
      );
    }

    await saveAttachments(formData, { serviceRecordId: recordId });

    await bumpVehicleUsage(part.vehicle_id, {
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
  const record = await one<{ part_id: string }>(`SELECT part_id FROM service_record WHERE id = ?`, [recordId]);
  if (!record) return;

  const part = await getPart(record.part_id);
  const attachments = await all<{ stored_name: string }>(
    `SELECT stored_name FROM attachment WHERE service_record_id = ?`,
    [recordId],
  );

  await run(`DELETE FROM service_record WHERE id = ?`, [recordId]);
  await Promise.all(attachments.map((row) => deleteUploadFile(row.stored_name)));

  if (part) revalidateVehicle(part.vehicle_id);
}

/**
 * Creates the ticked starter intervals in one transaction: a consumable part
 * row per preset, plus its schedule. Kept off the build sheet, because none of
 * these are modifications.
 *
 * Intervals count from where the vehicle is now rather than from an install
 * point, since nothing was installed — the vehicle simply starts being tracked
 * today.
 */
export async function applyStarterSchedulesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) return { error: "That vehicle no longer exists." };

  try {
    const chosen = new Set(formData.getAll("preset").map(String));
    const presets = starterSchedulesFor(vehicle).filter((preset) => chosen.has(preset.key));

    if (presets.length === 0) {
      throw new ValidationError("Tick at least one interval to add.");
    }

    // The form ships an editable copy of every interval, so the saved numbers
    // are whatever the owner's manual says rather than the generic default.
    const rows = presets.map((preset) => {
      const miles = parse.int(formData.get(`miles_${preset.key}`));
      const hours = parse.float(formData.get(`hours_${preset.key}`));
      const months = parse.int(formData.get(`months_${preset.key}`));

      const intervals = {
        interval_miles: miles && miles > 0 ? miles : null,
        interval_hours: hours && hours > 0 ? hours : null,
        interval_months: months && months > 0 ? months : null,
      };

      if (!intervals.interval_miles && !intervals.interval_hours && !intervals.interval_months) {
        throw new ValidationError(`${preset.part_name}: set an interval or untick it.`);
      }

      return { preset, intervals };
    });

    const timestamp = nowIso();
    const today = todayIso();

    await writeTransaction(async (tx) => {
      for (const { preset, intervals } of rows) {
        const partId = newId("part");

        await txRun(
          tx,
          `INSERT INTO part (id, vehicle_id, name, category, quantity, is_modification, is_oem,
                             status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, 0, 0, 'INSTALLED', ?, ?, ?)`,
          [
            partId,
            vehicle.id,
            preset.part_name,
            preset.category,
            "Created from the starter maintenance set.",
            timestamp,
            timestamp,
          ],
        );

        await txRun(
          tx,
          `INSERT INTO maintenance_schedule
             (id, part_id, task_type, label, interval_miles, interval_hours, interval_months,
              trigger_mode, base_mileage, base_hours, base_on, is_active, notes, created_at, updated_at)
           VALUES (@id, @part_id, @task_type, @label, @interval_miles, @interval_hours, @interval_months,
                   @trigger_mode, @base_mileage, @base_hours, @base_on, 1, NULL, @created_at, @updated_at)`,
          {
            ...intervals,
            id: newId("sch"),
            part_id: partId,
            task_type: preset.task_type,
            label: preset.label,
            trigger_mode: preset.trigger_mode,
            base_mileage: vehicle.current_mileage,
            base_hours: vehicle.current_engine_hours,
            base_on: today,
            created_at: timestamp,
            updated_at: timestamp,
          },
        );
      }
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(vehicleId);
  return { ok: true };
}
