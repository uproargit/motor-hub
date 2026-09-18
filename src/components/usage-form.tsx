"use client";

import { useActionState } from "react";

import { recordUsageAction } from "@/lib/actions/vehicles";
import type { FormState } from "@/lib/actions/shared";
import { todayIso } from "@/lib/dates";
import type { VehicleRow } from "@/lib/types";

import { Field, FormError, FormSuccess, Input, SubmitButton } from "./form";

/**
 * Updating the odometer or hour meter is what moves every maintenance
 * calculation on the vehicle, so it lives right on the overview.
 */
export function UsageForm({ vehicle }: { vehicle: VehicleRow }) {
  const [state, formAction] = useActionState<FormState, FormData>(recordUsageAction, {});

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <input type="hidden" name="vehicle_id" value={vehicle.id} />
      <FormError message={state.error} />
      {state.ok ? <FormSuccess message="Reading recorded." /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {vehicle.tracks_mileage ? (
          <Field label="Mileage" htmlFor="mileage">
            <Input
              id="mileage"
              name="mileage"
              inputMode="numeric"
              placeholder={vehicle.current_mileage?.toLocaleString("en-US") ?? "0"}
            />
          </Field>
        ) : null}
        {vehicle.tracks_engine_hours ? (
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
