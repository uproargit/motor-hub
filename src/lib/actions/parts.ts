"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { all, newId, nowIso, one, run, txAll, txRun, writeTransaction } from "../db";
import { todayIso } from "../dates";
import { getPart } from "../queries";
import { deleteUploadFile } from "../uploads";
import { inlineScheduleFrom, PART_COLUMNS, partFieldsFrom } from "./part-fields";
import {
  bumpVehicleUsage,
  enums,
  parse,
  requiredDate,
  saveAttachments,
  toFormState,
  ValidationError,
  type FormState,
} from "./shared";

/** Shared by the create and replace flows. */
const SCHEDULE_INSERT = `INSERT INTO maintenance_schedule
   (id, part_id, task_type, label, interval_miles, interval_hours, interval_months,
    trigger_mode, base_mileage, base_hours, base_on, is_active, notes, created_at, updated_at)
 VALUES (@id, @part_id, @task_type, @label, @interval_miles, @interval_hours, @interval_months,
         @trigger_mode, @base_mileage, @base_hours, @base_on, 1, @notes, @created_at, @updated_at)`;

interface InheritedSchedule {
  task_type: string;
  label: string | null;
  interval_miles: number | null;
  interval_hours: number | null;
  interval_months: number | null;
  trigger_mode: string;
  notes: string | null;
}

function revalidateVehicle(vehicleId: string): void {
  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicleId}`, "layout");
}

/**
 * Creates a part, optionally with its first maintenance schedule and any
 * receipts or photos attached in the same submission.
 */
export async function createPartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  let partId: string;

  try {
    const vehicle = await one<{ id: string }>(`SELECT id FROM vehicle WHERE id = ?`, [vehicleId]);
    if (!vehicle) throw new ValidationError("That vehicle no longer exists.");

    const fields = partFieldsFrom(formData);
    const schedule = inlineScheduleFrom(formData);
    const replacesPartId = parse.text(formData.get("replaces_part_id"));

    partId = newId("prt");
    const timestamp = nowIso();

    await run(
      `INSERT INTO part (id, vehicle_id, ${PART_COLUMNS.join(", ")}, replaces_part_id, created_at, updated_at)
       VALUES (@id, @vehicle_id, ${PART_COLUMNS.map((column) => `@${column}`).join(", ")}, @replaces_part_id, @created_at, @updated_at)`,
      {
        ...fields,
        id: partId,
        vehicle_id: vehicleId,
        replaces_part_id: replacesPartId,
        created_at: timestamp,
        updated_at: timestamp,
      },
    );

    if (schedule) {
      await run(SCHEDULE_INSERT, {
        ...schedule,
        id: newId("sch"),
        part_id: partId,
        // The first interval counts from the moment the part went on.
        base_mileage: fields.installed_mileage,
        base_hours: fields.installed_hours,
        base_on: fields.installed_on ?? todayIso(),
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    await saveAttachments(formData, { partId });

    await bumpVehicleUsage(vehicleId, {
      mileage: fields.installed_mileage,
      engineHours: fields.installed_hours,
      on: fields.installed_on,
      source: "PART_INSTALL",
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(vehicleId);
  redirect(`/vehicles/${vehicleId}/parts/${partId}`);
}

export async function updatePartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const partId = String(formData.get("part_id") ?? "");
  const existing = await getPart(partId);
  if (!existing) return { error: "That part no longer exists." };

  try {
    const fields = partFieldsFrom(formData);

    await run(
      `UPDATE part SET ${PART_COLUMNS.map((column) => `${column} = @${column}`).join(", ")}, updated_at = @updated_at
        WHERE id = @id`,
      { ...fields, id: partId, updated_at: nowIso() },
    );

    await saveAttachments(formData, { partId });

    await bumpVehicleUsage(existing.vehicle_id, {
      mileage: fields.installed_mileage,
      engineHours: fields.installed_hours,
      on: fields.installed_on,
      source: "PART_INSTALL",
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(existing.vehicle_id);
  redirect(`/vehicles/${existing.vehicle_id}/parts/${partId}`);
}

/**
 * Takes a part off the vehicle without deleting it. The row is retained with a
 * terminal status so the vehicle's history stays complete.
 */
export async function removePartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const partId = String(formData.get("part_id") ?? "");
  const existing = await getPart(partId);
  if (!existing) return { error: "That part no longer exists." };

  try {
    const status = enums.status(formData.get("status"));
    if (status === "INSTALLED") {
      throw new ValidationError("Choose the status the part ended up in, such as Removed, Sold or Failed.");
    }

    const removedOn = requiredDate(formData.get("removed_on"), "Removal date");
    const removedMileage = parse.int(formData.get("removed_mileage"));
    const removedHours = parse.float(formData.get("removed_hours"));

    await run(
      `UPDATE part
          SET status = ?, removed_on = ?, removed_mileage = ?, removed_hours = ?,
              removal_reason = ?, disposition = ?, sale_price_cents = ?, updated_at = ?
        WHERE id = ?`,
      [
        status,
        removedOn,
        removedMileage,
        removedHours,
        parse.text(formData.get("removal_reason")),
        enums.disposition(formData.get("disposition")),
        parse.money(formData.get("sale_price")),
        nowIso(),
        partId,
      ],
    );

    // A part that is off the vehicle should stop generating reminders.
    await run(`UPDATE maintenance_schedule SET is_active = 0, updated_at = ? WHERE part_id = ?`, [
      nowIso(),
      partId,
    ]);

    await bumpVehicleUsage(existing.vehicle_id, {
      mileage: removedMileage,
      engineHours: removedHours,
      on: removedOn,
      source: "PART_REMOVAL",
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(existing.vehicle_id);
  redirect(`/vehicles/${existing.vehicle_id}/parts/${partId}`);
}

/** Puts a removed part back on the vehicle, e.g. after a warranty repair. */
export async function reinstallPartAction(formData: FormData): Promise<void> {
  const partId = String(formData.get("part_id") ?? "");
  const existing = await getPart(partId);
  if (!existing) return;

  await run(
    `UPDATE part
        SET status = 'INSTALLED', removed_on = NULL, removed_mileage = NULL, removed_hours = NULL,
            removal_reason = NULL, disposition = NULL, sale_price_cents = NULL, updated_at = ?
      WHERE id = ?`,
    [nowIso(), partId],
  );

  await run(`UPDATE maintenance_schedule SET is_active = 1, updated_at = ? WHERE part_id = ?`, [
    nowIso(),
    partId,
  ]);

  revalidateVehicle(existing.vehicle_id);
}

/**
 * Hard delete, for mistakes only. Replacing a part should use the replacement
 * flow instead so the history is preserved.
 */
export async function deletePartAction(formData: FormData): Promise<void> {
  const partId = String(formData.get("part_id") ?? "");
  const existing = await getPart(partId);
  if (!existing) return;

  const attachments = await all<{ stored_name: string }>(
    `SELECT a.stored_name FROM attachment a
      WHERE a.part_id = ?
         OR a.service_record_id IN (SELECT id FROM service_record WHERE part_id = ?)`,
    [partId, partId],
  );

  await run(`DELETE FROM part WHERE id = ?`, [partId]);
  await Promise.all(attachments.map((row) => deleteUploadFile(row.stored_name)));

  revalidateVehicle(existing.vehicle_id);
  redirect(`/vehicles/${existing.vehicle_id}/parts`);
}

/**
 * Replaces a part without losing the old one.
 *
 *   OEM Battery      installed factory, removed 6/14/26, reason "Failed"
 *   Odyssey Battery  installed 6/14/26 at 18,242 miles, $289, 4 year warranty
 *
 * The outgoing row is closed out as REPLACED and the incoming row points back
 * at it, so the pair reads as one continuous chain on the part's history.
 */
export async function replacePartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const oldPartId = String(formData.get("replaces_part_id") ?? "");
  const outgoing = await getPart(oldPartId);
  if (!outgoing) return { error: "The part being replaced no longer exists." };

  let newPartId: string;

  try {
    const fields = partFieldsFrom(formData);
    if (fields.status !== "INSTALLED") {
      throw new ValidationError("A replacement part has to be installed. Use the removal form instead.");
    }

    const removedOn = requiredDate(formData.get("removed_on"), "Removal date");
    const removedMileage = parse.int(formData.get("removed_mileage"));
    const removedHours = parse.float(formData.get("removed_hours"));
    const copySchedules = parse.flag(formData.get("copy_schedules")) === 1;

    newPartId = newId("prt");
    const timestamp = nowIso();

    // The insert, the close-out of the old part and any inherited schedules
    // all land together: a half-applied replacement would corrupt the history.
    await writeTransaction(async (tx) => {
      await txRun(
        tx,
        `INSERT INTO part (id, vehicle_id, ${PART_COLUMNS.join(", ")}, replaces_part_id, created_at, updated_at)
         VALUES (@id, @vehicle_id, ${PART_COLUMNS.map((column) => `@${column}`).join(", ")}, @replaces_part_id, @created_at, @updated_at)`,
        {
          ...fields,
          id: newPartId,
          vehicle_id: outgoing.vehicle_id,
          replaces_part_id: oldPartId,
          created_at: timestamp,
          updated_at: timestamp,
        },
      );

      await txRun(
        tx,
        `UPDATE part
            SET status = 'REPLACED', removed_on = ?, removed_mileage = ?, removed_hours = ?,
                removal_reason = ?, disposition = ?, sale_price_cents = ?, updated_at = ?
          WHERE id = ?`,
        [
          removedOn,
          removedMileage,
          removedHours,
          parse.text(formData.get("removal_reason")),
          enums.disposition(formData.get("disposition")),
          parse.money(formData.get("sale_price")),
          timestamp,
          oldPartId,
        ],
      );

      await txRun(tx, `UPDATE maintenance_schedule SET is_active = 0, updated_at = ? WHERE part_id = ?`, [
        timestamp,
        oldPartId,
      ]);

      // Intervals on a carried-over schedule restart from the new install point.
      const rebase = {
        base_mileage: fields.installed_mileage,
        base_hours: fields.installed_hours,
        base_on: fields.installed_on ?? todayIso(),
        created_at: timestamp,
        updated_at: timestamp,
      };

      if (copySchedules) {
        const inherited = await txAll<InheritedSchedule>(
          tx,
          `SELECT task_type, label, interval_miles, interval_hours, interval_months, trigger_mode, notes
             FROM maintenance_schedule WHERE part_id = ?`,
          [oldPartId],
        );

        for (const schedule of inherited) {
          await txRun(tx, SCHEDULE_INSERT, {
            ...schedule,
            ...rebase,
            id: newId("sch"),
            part_id: newPartId,
          });
        }
      }

      const inlineSchedule = inlineScheduleFrom(formData);
      if (inlineSchedule) {
        await txRun(tx, SCHEDULE_INSERT, {
          ...inlineSchedule,
          ...rebase,
          id: newId("sch"),
          part_id: newPartId,
        });
      }
    });

    await saveAttachments(formData, { partId: newPartId });

    await bumpVehicleUsage(outgoing.vehicle_id, {
      mileage: fields.installed_mileage ?? removedMileage,
      engineHours: fields.installed_hours ?? removedHours,
      on: fields.installed_on ?? removedOn,
      source: "PART_REPLACEMENT",
    });
  } catch (error) {
    return toFormState(error);
  }

  revalidateVehicle(outgoing.vehicle_id);
  redirect(`/vehicles/${outgoing.vehicle_id}/parts/${newPartId}`);
}
