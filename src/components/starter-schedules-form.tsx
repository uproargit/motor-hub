"use client";

import { useActionState } from "react";

import { applyStarterSchedulesAction } from "@/lib/actions/maintenance";
import type { FormState } from "@/lib/actions/shared";
import { TASK_TYPES } from "@/lib/domain";
import type { StarterSchedule } from "@/lib/starter-schedules";
import type { VehicleRow } from "@/lib/types";

import { FormError, FormSuccess, Input, SubmitButton } from "./form";

/**
 * A ticklist of common factory intervals for this kind of machine. Every
 * number is editable before it is saved, because these are generic figures and
 * the owner's manual wins.
 */
export function StarterSchedulesForm({
  vehicle,
  presets,
}: {
  vehicle: VehicleRow;
  presets: StarterSchedule[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(applyStarterSchedulesAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="vehicle_id" value={vehicle.id} />
      <FormError message={state.error} />
      {state.ok ? <FormSuccess message="Schedules added. They are on the maintenance tab now." /> : null}

      <ul className="space-y-2.5">
        {presets.map((preset) => (
          <li key={preset.key} className="rounded-lg border border-line bg-raised px-3 py-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="preset"
                value={preset.key}
                defaultChecked
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{preset.part_name}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {TASK_TYPES[preset.task_type].verb} · {preset.label}
                </span>
              </span>
            </label>

            <div className="mt-3 grid gap-2 pl-7 sm:grid-cols-3">
              {vehicle.tracks_mileage ? (
                <label className="text-xs text-muted">
                  Every … miles
                  <Input
                    name={`miles_${preset.key}`}
                    inputMode="numeric"
                    defaultValue={preset.interval_miles ?? ""}
                    placeholder="—"
                  />
                </label>
              ) : null}
              {vehicle.tracks_engine_hours ? (
                <label className="text-xs text-muted">
                  Every … engine hours
                  <Input
                    name={`hours_${preset.key}`}
                    inputMode="decimal"
                    defaultValue={preset.interval_hours ?? ""}
                    placeholder="—"
                  />
                </label>
              ) : null}
              <label className="text-xs text-muted">
                Every … months
                <Input
                  name={`months_${preset.key}`}
                  inputMode="numeric"
                  defaultValue={preset.interval_months ?? ""}
                  placeholder="—"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <SubmitButton>Add these schedules</SubmitButton>
    </form>
  );
}
