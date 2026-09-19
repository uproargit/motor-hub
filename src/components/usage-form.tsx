"use client";

import { useActionState } from "react";

import { recordUsageAction } from "@/lib/actions/vehicles";
import type { FormState } from "@/lib/actions/shared";
import { todayIso } from "@/lib/dates";
import { usageFieldsFor } from "@/lib/due";
import type { VehicleRow } from "@/lib/types";

import { Field, FormError, FormSuccess, Input, SubmitButton } from "./form";

/**
 * Updating the odometer or hour meter is what moves every maintenance
 * calculation on the vehicle, so it lives right on the overview.
 *
 * `fields` decides which meters are offered. Callers that know the vehicle's
 * schedules pass the answer in, so a schedule that needs a reading always has
 * somewhere to get one — see `usageFieldsFor`.
 */
export function UsageForm({
  vehicle,
  fields = usageFieldsFor(vehicle, []),
}: {
  vehicle: VehicleRow;
  fields?: { mileage: boolean; engineHours: boolean };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(recordUsageAction, {});

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <input type="hidden" name="vehicle_id" value={vehicle.id} />
      <FormError message={state.error} />
      {state.ok ? <FormSuccess message="Reading recorded." /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {fields.mileage ? (
          <Field label="Mileage" htmlFor="mileage">
            <Input
              id="mileage"
              name="mileage"
              inputMode="numeric"
              placeholder={vehicle.current_mileage?.toLocaleString("en-US") ?? "0"}
            />
          </Field>
        ) : null}
        {fields.engineHours ? (
          <Field label="Engine hours" htmlFor="engine_hours">
            <Input
              id="engine_hours"
              name="engine_hours"
              inputMode="decimal"
              placeholder={vehicle.current_engine_hours?.toString() ?? "0"}
            />
          </Field>
        ) : null}
        <Field label="Date" htmlFor="recorded_on">
          <Input id="recorded_on" name="recorded_on" type="date" defaultValue={todayIso()} required />
        </Field>
      </div>

      <SubmitButton variant="secondary" pendingLabel="Recording…">
        Record reading
      </SubmitButton>
    </form>
  );
}
