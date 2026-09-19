"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { FormState } from "@/lib/actions/shared";
import { VEHICLE_TYPES, VEHICLE_TYPE_KEYS, type VehicleType } from "@/lib/domain";
import { vehicleTitle } from "@/lib/part-logic";
import type { VehicleRow } from "@/lib/types";

import { Field, FormError, FormSection, Input, MoneyInput, Select, SubmitButton, Textarea } from "./form";

const TYPE_OPTIONS = VEHICLE_TYPE_KEYS.map((key) => ({
  value: key,
  label: `${VEHICLE_TYPES[key].icon}  ${VEHICLE_TYPES[key].label}`,
}));

export function VehicleForm({
  action,
  vehicle,
  parentOptions,
  cancelHref,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  vehicle: VehicleRow | null;
  /** Vehicles this one may be attached to. Empty means the field is pointless. */
  parentOptions: VehicleRow[];
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  // Picking a type pre-selects the meters that kind of machine usually has,
  // which the user can still override.
  const [type, setType] = useState<VehicleType>(vehicle?.vehicle_type ?? "CAR");
  const [meters, setMeters] = useState({
    miles: vehicle ? vehicle.tracks_mileage === 1 : VEHICLE_TYPES.CAR.tracksMileage,
    hours: vehicle ? vehicle.tracks_engine_hours === 1 : VEHICLE_TYPES.CAR.tracksEngineHours,
  });

  function onTypeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as VehicleType;
    setType(next);
    if (!vehicle) {
      setMeters({ miles: VEHICLE_TYPES[next].tracksMileage, hours: VEHICLE_TYPES[next].tracksEngineHours });
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {vehicle ? <input type="hidden" name="vehicle_id" value={vehicle.id} /> : null}
      <FormError message={state.error} />

      <FormSection title="Vehicle">
        <Field label="Type" htmlFor="vehicle_type">
          <Select id="vehicle_type" name="vehicle_type" options={TYPE_OPTIONS} value={type} onChange={onTypeChange} />
        </Field>
        <Field label="Nickname" htmlFor="nickname" hint="Shown instead of year/make/model.">
          <Input id="nickname" name="nickname" defaultValue={vehicle?.nickname ?? ""} placeholder="The RZR" />
        </Field>
        <Field label="Year" htmlFor="year">
          <Input id="year" name="year" inputMode="numeric" defaultValue={vehicle?.year ?? ""} placeholder="2024" />
        </Field>
        <Field label="Make" htmlFor="make">
          <Input id="make" name="make" required defaultValue={vehicle?.make ?? ""} placeholder="Polaris" />
        </Field>
        <Field label="Model" htmlFor="model">
          <Input id="model" name="model" required defaultValue={vehicle?.model ?? ""} placeholder="RZR" />
        </Field>
        <Field label="Trim" htmlFor="trim">
          <Input id="trim" name="trim" defaultValue={vehicle?.trim ?? ""} placeholder="Pro R" />
        </Field>
        <Field label="VIN / HIN" htmlFor="vin">
          <Input id="vin" name="vin" defaultValue={vehicle?.vin ?? ""} />
        </Field>
        <Field label="Plate" htmlFor="plate">
          <Input id="plate" name="plate" defaultValue={vehicle?.plate ?? ""} />
        </Field>
        <Field label="Color" htmlFor="color">
          <Input id="color" name="color" defaultValue={vehicle?.color ?? ""} />
        </Field>
      </FormSection>

      <FormSection
        title="Usage meters"
        description="Maintenance intervals are calculated from these."
      >
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5">
            <input
              type="checkbox"
              name="tracks_mileage"
              checked={meters.miles}
              onChange={(event) => setMeters((previous) => ({ ...previous, miles: event.target.checked }))}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Tracks mileage</span>
              <span className="mt-0.5 block text-xs text-muted">This machine has an odometer.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5">
            <input
              type="checkbox"
              name="tracks_engine_hours"
              checked={meters.hours}
              onChange={(event) => setMeters((previous) => ({ ...previous, hours: event.target.checked }))}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-ink">Tracks engine hours</span>
              <span className="mt-0.5 block text-xs text-muted">Common on UTVs, boats and equipment.</span>
            </span>
          </label>
        </div>

        {!vehicle && meters.miles ? (
          <Field label="Current mileage" htmlFor="current_mileage">
            <Input id="current_mileage" name="current_mileage" inputMode="numeric" placeholder="18242" />
          </Field>
        ) : null}
        {!vehicle && meters.hours ? (
          <Field label="Current engine hours" htmlFor="current_engine_hours">
            <Input id="current_engine_hours" name="current_engine_hours" inputMode="decimal" placeholder="84" />
          </Field>
        ) : null}
      </FormSection>

      {parentOptions.length > 0 || vehicle?.parent_vehicle_id ? (
        <FormSection
          title="Goes with"
          collapsible
          defaultOpen={false}
          description="For a trailer that carries a boat, or anything else that travels with another vehicle"
        >
          <Field
            label="Belongs to"
            htmlFor="parent_vehicle_id"
            className="sm:col-span-2"
            hint="It keeps its own parts, schedules and history — this only links the two."
          >
            <Select
              id="parent_vehicle_id"
              name="parent_vehicle_id"
              defaultValue={vehicle?.parent_vehicle_id ?? ""}
              options={[
                { value: "", label: "Nothing — it stands alone" },
                ...parentOptions.map((option) => ({
                  value: option.id,
                  label: vehicleTitle(option),
                })),
              ]}
            />
          </Field>
        </FormSection>
      ) : null}

      <FormSection title="Ownership" collapsible defaultOpen={false} description="Purchase details and notes">
        <Field label="Purchase date" htmlFor="purchased_on">
          <Input id="purchased_on" name="purchased_on" type="date" defaultValue={vehicle?.purchased_on ?? ""} />
        </Field>
        <Field label="Purchase price" htmlFor="purchase_price">
          <MoneyInput
            id="purchase_price"
            name="purchase_price"
            defaultValue={vehicle?.purchase_price_cents != null ? (vehicle.purchase_price_cents / 100).toFixed(2) : ""}
            placeholder="0.00"
          />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={vehicle?.notes ?? ""} />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
