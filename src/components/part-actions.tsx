"use client";

import { useActionState } from "react";

import { addPartAttachmentsAction } from "@/lib/actions/attachments";
import { createScheduleAction, logServiceAction, updateScheduleAction } from "@/lib/actions/maintenance";
import { removePartAction } from "@/lib/actions/parts";
import type { FormState } from "@/lib/actions/shared";
import { todayIso } from "@/lib/dates";
import {
  ATTACHMENT_KINDS,
  ATTACHMENT_KIND_KEYS,
  DISPOSITIONS,
  DISPOSITION_KEYS,
  INSTALLED_BY,
  INSTALLED_BY_KEYS,
  PART_STATUSES,
  PART_STATUS_KEYS,
  TASK_TYPES,
  TASK_TYPE_KEYS,
} from "@/lib/domain";
import type { PartRow, ScheduleRow, VehicleRow } from "@/lib/types";

import {
  CheckboxField,
  Field,
  FormError,
  FormSection,
  FormSuccess,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
  Textarea,
} from "./form";

const TASK_OPTIONS = TASK_TYPE_KEYS.map((key) => ({ value: key, label: TASK_TYPES[key].label }));
const PERFORMER_OPTIONS = INSTALLED_BY_KEYS.map((key) => ({ value: key, label: INSTALLED_BY[key] }));
const KIND_OPTIONS = ATTACHMENT_KIND_KEYS.map((key) => ({ value: key, label: ATTACHMENT_KINDS[key] }));
const REMOVAL_STATUS_OPTIONS = PART_STATUS_KEYS.filter((key) => key !== "INSTALLED").map((key) => ({
  value: key,
  label: PART_STATUSES[key].label,
}));
const DISPOSITION_OPTIONS = [
  { value: "", label: "Not recorded" },
  ...DISPOSITION_KEYS.map((key) => ({ value: key, label: DISPOSITIONS[key] })),
];

/** Attaches another maintenance interval to an existing part. */
export function AddScheduleForm({ part, vehicle }: { part: PartRow; vehicle: VehicleRow }) {
  const [state, formAction] = useActionState<FormState, FormData>(createScheduleAction, {});

  return (
    <form action={formAction} className="space-y-3 border-t border-line px-5 py-4">
      <input type="hidden" name="part_id" value={part.id} />
      <p className="text-sm font-semibold text-ink">Add a maintenance schedule</p>
      <FormError message={state.error} />
      {state.ok ? <FormSuccess message="Schedule added." /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Task" htmlFor="task_type">
          <Select id="task_type" name="task_type" options={TASK_OPTIONS} />
        </Field>
        <Field label="Label" htmlFor="label" hint="Optional, e.g. “Re-torque lug nuts”.">
          <Input id="label" name="label" />
        </Field>
        {vehicle.tracks_mileage ? (
          <Field label="Every … miles" htmlFor="interval_miles">
            <Input id="interval_miles" name="interval_miles" inputMode="numeric" placeholder="5000" />
          </Field>
        ) : null}
        {vehicle.tracks_engine_hours ? (
          <Field label="Every … engine hours" htmlFor="interval_hours">
            <Input id="interval_hours" name="interval_hours" inputMode="decimal" placeholder="50" />
          </Field>
        ) : null}
        <Field label="Every … months" htmlFor="interval_months">
          <Input id="interval_months" name="interval_months" inputMode="numeric" placeholder="12" />
        </Field>
        <Field label="When several are set" htmlFor="trigger_mode">
          <Select
            id="trigger_mode"
            name="trigger_mode"
            options={[
              { value: "FIRST", label: "Whichever comes first" },
              { value: "LAST", label: "Only when all have elapsed" },
            ]}
          />
        </Field>
      </div>

      <SubmitButton variant="secondary">Add schedule</SubmitButton>
    </form>
  );
}

/**
 * Edits an interval in place. Without this the only way to correct a number was
 * to delete the schedule and add it again, which threw away its baseline.
 */
export function EditScheduleForm({ schedule, vehicle }: { schedule: ScheduleRow; vehicle: VehicleRow }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateScheduleAction, {});
  const showMiles = vehicle.tracks_mileage === 1 || schedule.interval_miles != null;
  const showHours = vehicle.tracks_engine_hours === 1 || schedule.interval_hours != null;

  return (
    <details className="mt-2 rounded-lg border border-line bg-base px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted">Edit this interval</summary>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="schedule_id" value={schedule.id} />
        <FormError message={state.error} />
        {state.ok ? <FormSuccess message="Schedule updated." /> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Task" htmlFor={`task_type_${schedule.id}`}>
            <Select
              id={`task_type_${schedule.id}`}
              name="task_type"
              options={TASK_OPTIONS}
              defaultValue={schedule.task_type}
            />
          </Field>
          <Field label="Label" htmlFor={`label_${schedule.id}`}>
            <Input id={`label_${schedule.id}`} name="label" defaultValue={schedule.label ?? ""} />
          </Field>
          {showMiles ? (
            <Field label="Every … miles" htmlFor={`interval_miles_${schedule.id}`}>
              <Input
                id={`interval_miles_${schedule.id}`}
                name="interval_miles"
                inputMode="numeric"
                defaultValue={schedule.interval_miles ?? ""}
              />
            </Field>
          ) : null}
          {showHours ? (
            <Field label="Every … engine hours" htmlFor={`interval_hours_${schedule.id}`}>
              <Input
                id={`interval_hours_${schedule.id}`}
                name="interval_hours"
                inputMode="decimal"
                defaultValue={schedule.interval_hours ?? ""}
              />
            </Field>
          ) : null}
          <Field label="Every … months" htmlFor={`interval_months_${schedule.id}`}>
            <Input
              id={`interval_months_${schedule.id}`}
              name="interval_months"
              inputMode="numeric"
              defaultValue={schedule.interval_months ?? ""}
            />
          </Field>
          <Field label="When several are set" htmlFor={`trigger_mode_${schedule.id}`}>
            <Select
              id={`trigger_mode_${schedule.id}`}
              name="trigger_mode"
              options={[
                { value: "FIRST", label: "Whichever comes first" },
                { value: "LAST", label: "Only when all have elapsed" },
              ]}
              defaultValue={schedule.trigger_mode}
            />
          </Field>
        </div>

        <FormSection title="Interval starts from" collapsible defaultOpen={false}>
          <Field
            label="Date"
            htmlFor={`base_on_${schedule.id}`}
            hint="Logging a service moves this on for you."
          >
            <Input
              id={`base_on_${schedule.id}`}
              name="base_on"
              type="date"
              defaultValue={schedule.base_on ?? ""}
            />
          </Field>
          {showMiles ? (
            <Field label="Mileage" htmlFor={`base_mileage_${schedule.id}`}>
              <Input
                id={`base_mileage_${schedule.id}`}
                name="base_mileage"
                inputMode="numeric"
                defaultValue={schedule.base_mileage ?? ""}
              />
            </Field>
          ) : null}
          {showHours ? (
            <Field label="Engine hours" htmlFor={`base_hours_${schedule.id}`}>
              <Input
                id={`base_hours_${schedule.id}`}
                name="base_hours"
                inputMode="decimal"
                defaultValue={schedule.base_hours ?? ""}
              />
            </Field>
          ) : null}
        </FormSection>

        <Field label="Notes" htmlFor={`notes_${schedule.id}`}>
          <Textarea id={`notes_${schedule.id}`} name="notes" rows={2} defaultValue={schedule.notes ?? ""} />
        </Field>

        <CheckboxField
          name="is_active"
          label="Active"
          hint="Untick to stop this interval generating reminders."
          defaultChecked={schedule.is_active === 1}
        />

        <SubmitButton variant="secondary">Save interval</SubmitButton>
      </form>
    </details>
  );
}

/** Logs a completed service, which also restarts the schedule's interval. */
export function LogServiceForm({
  part,
  vehicle,
  schedules,
}: {
  part: PartRow;
  vehicle: VehicleRow;
  schedules: ScheduleRow[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(logServiceAction, {});

  const scheduleOptions = [
    { value: "", label: "Not tied to a schedule" },
    ...schedules.map((schedule) => ({
      value: schedule.id,
      label: schedule.label ?? TASK_TYPES[schedule.task_type].label,
    })),
  ];

  return (
    <form action={formAction} className="space-y-3 border-t border-line px-5 py-4">
      <input type="hidden" name="part_id" value={part.id} />
      <p className="text-sm font-semibold text-ink">Log a service or inspection</p>
      <FormError message={state.error} />
      {state.ok ? <FormSuccess message="Service logged — the interval restarts from here." /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" htmlFor="performed_on">
          <Input id="performed_on" name="performed_on" type="date" defaultValue={todayIso()} required />
        </Field>
        <Field label="What was done" htmlFor="service_task_type">
          <Select id="service_task_type" name="task_type" options={TASK_OPTIONS} />
        </Field>
        {schedules.length > 0 ? (
          <Field label="Against schedule" htmlFor="schedule_id" className="sm:col-span-2">
            <Select id="schedule_id" name="schedule_id" options={scheduleOptions} />
          </Field>
        ) : null}
        {vehicle.tracks_mileage ? (
          <Field label="Mileage" htmlFor="service_mileage">
            <Input
              id="service_mileage"
              name="mileage"
              inputMode="numeric"
              placeholder={vehicle.current_mileage?.toLocaleString("en-US") ?? ""}
            />
          </Field>
        ) : null}
        {vehicle.tracks_engine_hours ? (
          <Field label="Engine hours" htmlFor="service_hours">
            <Input
              id="service_hours"
              name="engine_hours"
              inputMode="decimal"
              placeholder={vehicle.current_engine_hours?.toString() ?? ""}
            />
          </Field>
        ) : null}
        <Field label="Performed by" htmlFor="performed_by">
          <Select id="performed_by" name="performed_by" options={PERFORMER_OPTIONS} />
        </Field>
        <Field label="Shop / technician" htmlFor="performer_name">
          <Input id="performer_name" name="performer_name" />
        </Field>
        <Field label="Cost" htmlFor="service_cost">
          <MoneyInput id="service_cost" name="cost" placeholder="0.00" />
        </Field>
        <Field label="Outcome" htmlFor="outcome" hint="Passed, worn, replaced…">
          <Input id="outcome" name="outcome" />
        </Field>
        <Field label="Notes" htmlFor="service_notes" className="sm:col-span-2">
          <Textarea id="service_notes" name="notes" rows={2} />
        </Field>
        <Field label="Receipt or photo" htmlFor="service_files" className="sm:col-span-2">
          <Input id="service_files" name="files" type="file" multiple accept="image/*,application/pdf" />
          <input type="hidden" name="file_kind" value="RECEIPT" />
        </Field>
      </div>

      <SubmitButton variant="secondary">Log service</SubmitButton>
    </form>
  );
}

export function AddAttachmentsForm({ part }: { part: PartRow }) {
  const [state, formAction] = useActionState<FormState, FormData>(addPartAttachmentsAction, {});

  return (
    <form action={formAction} className="space-y-3 border-t border-line px-5 py-4">
      <input type="hidden" name="part_id" value={part.id} />
      <FormError message={state.error} />
      {state.ok ? <FormSuccess message="Uploaded." /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="File type" htmlFor="attachment_kind">
          <Select id="attachment_kind" name="file_kind" options={KIND_OPTIONS} />
        </Field>
        <Field label="Caption" htmlFor="attachment_caption">
          <Input id="attachment_caption" name="file_caption" />
        </Field>
        <Field label="Files" htmlFor="attachment_files" className="sm:col-span-2">
          <Input id="attachment_files" name="files" type="file" multiple accept="image/*,application/pdf" required />
        </Field>
      </div>

      <SubmitButton variant="secondary">Upload</SubmitButton>
    </form>
  );
}

/** Takes a part off the vehicle while keeping its record intact. */
export function RemovePartForm({ part, vehicle }: { part: PartRow; vehicle: VehicleRow }) {
  const [state, formAction] = useActionState<FormState, FormData>(removePartAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="part_id" value={part.id} />
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date removed" htmlFor="removed_on">
          <Input id="removed_on" name="removed_on" type="date" defaultValue={todayIso()} required />
        </Field>
        <Field label="New status" htmlFor="status">
          <Select id="status" name="status" options={REMOVAL_STATUS_OPTIONS} defaultValue="REMOVED" />
        </Field>
        {vehicle.tracks_mileage ? (
          <Field label="Mileage at removal" htmlFor="removed_mileage">
            <Input
              id="removed_mileage"
              name="removed_mileage"
              inputMode="numeric"
              placeholder={vehicle.current_mileage?.toLocaleString("en-US") ?? ""}
            />
          </Field>
        ) : null}
        {vehicle.tracks_engine_hours ? (
          <Field label="Engine hours at removal" htmlFor="removed_hours">
            <Input
              id="removed_hours"
              name="removed_hours"
              inputMode="decimal"
              placeholder={vehicle.current_engine_hours?.toString() ?? ""}
            />
          </Field>
        ) : null}
        <Field label="Reason" htmlFor="removal_reason" hint="Failed, upgraded, worn out, recall…">
          <Input id="removal_reason" name="removal_reason" />
        </Field>
        <Field label="What happened to it" htmlFor="disposition">
          <Select id="disposition" name="disposition" options={DISPOSITION_OPTIONS} />
        </Field>
        <Field label="Sale price" htmlFor="sale_price" hint="If you sold it on.">
          <MoneyInput id="sale_price" name="sale_price" placeholder="0.00" />
        </Field>
      </div>

      <p className="rounded-lg border border-line bg-raised px-3 py-2 text-sm text-muted">
        The part stays on this vehicle&rsquo;s permanent history. Its maintenance schedules stop generating reminders.
      </p>

      <SubmitButton>Record removal</SubmitButton>
    </form>
  );
}
