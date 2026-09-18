"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { todayIso } from "@/lib/dates";
import {
  DISPOSITIONS,
  DISPOSITION_KEYS,
  INSTALLED_BY,
  INSTALLED_BY_KEYS,
  PART_CATEGORIES,
  PART_CATEGORY_KEYS,
  PART_STATUSES,
  PART_STATUS_KEYS,
  TASK_TYPES,
  TASK_TYPE_KEYS,
  WARRANTY_TYPES,
  WARRANTY_TYPE_KEYS,
} from "@/lib/domain";
import { formatMoney, moneyInputValue } from "@/lib/format";
import type { FormState } from "@/lib/actions/shared";
import type { PartRow, VehicleRow } from "@/lib/types";

import {
  CheckboxField,
  Field,
  FormError,
  FormSection,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
  Textarea,
} from "./form";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const CATEGORY_OPTIONS = PART_CATEGORY_KEYS.map((key) => ({ value: key, label: PART_CATEGORIES[key].label }));
const STATUS_OPTIONS = PART_STATUS_KEYS.map((key) => ({ value: key, label: PART_STATUSES[key].label }));
const INSTALLER_OPTIONS = INSTALLED_BY_KEYS.map((key) => ({ value: key, label: INSTALLED_BY[key] }));
const WARRANTY_OPTIONS = WARRANTY_TYPE_KEYS.map((key) => ({ value: key, label: WARRANTY_TYPES[key] }));
const TASK_OPTIONS = TASK_TYPE_KEYS.map((key) => ({ value: key, label: TASK_TYPES[key].label }));
const DISPOSITION_OPTIONS = [
  { value: "", label: "Not recorded" },
  ...DISPOSITION_KEYS.map((key) => ({ value: key, label: DISPOSITIONS[key] })),
];

/** Running total of the four cost fields, mirroring `total_installed_cost`. */
function useCostTotal(part: PartRow | null) {
  const [costs, setCosts] = useState({
    part_cost: moneyInputValue(part?.part_cost_cents),
    labor_cost: moneyInputValue(part?.labor_cost_cents),
    shipping_cost: moneyInputValue(part?.shipping_cost_cents),
    tax: moneyInputValue(part?.tax_cents),
  });

  const total = Object.values(costs).reduce((sum, value) => {
    const parsed = Number(value);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

  const anyEntered = Object.values(costs).some((value) => value.trim() !== "");

  return {
    costs,
    total: anyEntered ? Math.round(total * 100) : null,
    onChange: (key: keyof typeof costs) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setCosts((previous) => ({ ...previous, [key]: event.target.value })),
  };
}

export function PartForm({
  action,
  vehicle,
  part,
  mode,
  outgoingPart,
  cancelHref,
  submitLabel,
}: {
  action: Action;
  vehicle: VehicleRow;
  part: PartRow | null;
  mode: "create" | "edit" | "replace";
  outgoingPart?: PartRow;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const { costs, total, onChange } = useCostTotal(part);
  const today = todayIso();

  const tracksMiles = vehicle.tracks_mileage === 1;
  const tracksHours = vehicle.tracks_engine_hours === 1;
  const showSchedule = mode !== "edit";

  return (
    <form action={formAction} className="space-y-5">
      {mode === "create" ? <input type="hidden" name="vehicle_id" value={vehicle.id} /> : null}
      {mode === "edit" && part ? <input type="hidden" name="part_id" value={part.id} /> : null}
      {mode === "replace" && outgoingPart ? (
        <>
          <input type="hidden" name="replaces_part_id" value={outgoingPart.id} />
          <input type="hidden" name="status" value="INSTALLED" />
        </>
      ) : null}

      <FormError message={state.error} />

      {mode === "replace" && outgoingPart ? (
        <FormSection
          title={`Outgoing: ${outgoingPart.name}`}
          description="The old part is kept forever — it is closed out, not deleted."
        >
          <Field label="Date removed" htmlFor="removed_on">
            <Input id="removed_on" name="removed_on" type="date" defaultValue={today} required />
          </Field>
          <Field label="Reason for removal" htmlFor="removal_reason" hint="Failed, upgraded, worn out, recall…">
            <Input id="removal_reason" name="removal_reason" placeholder="Failed" />
          </Field>
          {tracksMiles ? (
            <Field label="Mileage at removal" htmlFor="removed_mileage">
              <Input id="removed_mileage" name="removed_mileage" inputMode="numeric" placeholder="18,242" />
            </Field>
          ) : null}
          {tracksHours ? (
            <Field label="Engine hours at removal" htmlFor="removed_hours">
              <Input id="removed_hours" name="removed_hours" inputMode="decimal" placeholder="142" />
            </Field>
          ) : null}
          <Field label="What happened to it" htmlFor="disposition">
            <Select id="disposition" name="disposition" options={DISPOSITION_OPTIONS} />
          </Field>
          <Field label="Sale price" htmlFor="sale_price" hint="If you sold the old part.">
            <MoneyInput id="sale_price" name="sale_price" placeholder="0.00" />
          </Field>
          <div className="sm:col-span-2">
            <CheckboxField
              name="copy_schedules"
              label="Copy maintenance schedules to the new part"
              hint="Intervals restart from the new part's install point."
              defaultChecked
            />
          </div>
        </FormSection>
      ) : null}

      <FormSection title={mode === "replace" ? "Incoming part" : "Part or modification"}>
        <Field label="Name" htmlFor="name" className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            required
            defaultValue={part?.name ?? ""}
            placeholder="Method 401 Beadlock Wheels"
          />
        </Field>
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" options={CATEGORY_OPTIONS} defaultValue={part?.category ?? "OTHER"} />
        </Field>
        <Field label="Manufacturer / brand" htmlFor="manufacturer">
          <Input id="manufacturer" name="manufacturer" defaultValue={part?.manufacturer ?? ""} placeholder="Method Race Wheels" />
        </Field>
        <Field label="Part number / SKU" htmlFor="part_number">
          <Input id="part_number" name="part_number" defaultValue={part?.part_number ?? ""} placeholder="MR40157" />
        </Field>
        <Field label="Quantity" htmlFor="quantity">
          <Input id="quantity" name="quantity" inputMode="decimal" defaultValue={part?.quantity ?? 1} />
        </Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={part?.description ?? ""} />
        </Field>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <CheckboxField
            name="is_modification"
            label="Show on the build sheet"
            hint="Modifications appear on the build sheet; consumables stay in the parts list."
            defaultChecked={part ? part.is_modification === 1 : true}
          />
          <CheckboxField
            name="is_oem"
            label="OEM / factory part"
            defaultChecked={part ? part.is_oem === 1 : false}
          />
        </div>
      </FormSection>

      <FormSection title="Installation">
        <Field label="Date installed" htmlFor="installed_on">
          <Input id="installed_on" name="installed_on" type="date" defaultValue={part?.installed_on ?? (mode === "edit" ? "" : today)} />
        </Field>
        {mode !== "replace" ? (
          <Field label="Current status" htmlFor="status">
            <Select id="status" name="status" options={STATUS_OPTIONS} defaultValue={part?.status ?? "INSTALLED"} />
          </Field>
        ) : null}
        {tracksMiles ? (
          <Field
            label="Mileage when installed"
            htmlFor="installed_mileage"
            hint={vehicle.current_mileage != null ? `Vehicle currently reads ${vehicle.current_mileage.toLocaleString("en-US")} mi` : undefined}
          >
            <Input
              id="installed_mileage"
              name="installed_mileage"
              inputMode="numeric"
              defaultValue={part?.installed_mileage ?? ""}
              placeholder="2400"
            />
          </Field>
        ) : null}
        {tracksHours ? (
          <Field
            label="Engine hours when installed"
            htmlFor="installed_hours"
            hint={vehicle.current_engine_hours != null ? `Vehicle currently reads ${vehicle.current_engine_hours} hr` : undefined}
          >
            <Input
              id="installed_hours"
              name="installed_hours"
              inputMode="decimal"
              defaultValue={part?.installed_hours ?? ""}
              placeholder="42"
            />
          </Field>
        ) : null}
        <Field label="Installed by" htmlFor="installed_by">
          <Select id="installed_by" name="installed_by" options={INSTALLER_OPTIONS} defaultValue={part?.installed_by ?? "SELF"} />
        </Field>
        <Field label="Installer / shop name" htmlFor="installer_name">
          <Input id="installer_name" name="installer_name" defaultValue={part?.installer_name ?? ""} placeholder="Desert Performance" />
        </Field>
        <Field label="Installer phone" htmlFor="installer_phone">
          <Input id="installer_phone" name="installer_phone" type="tel" defaultValue={part?.installer_phone ?? ""} />
        </Field>
        <Field label="Installer email" htmlFor="installer_email">
          <Input id="installer_email" name="installer_email" type="email" defaultValue={part?.installer_email ?? ""} />
        </Field>
        <Field label="Installer address" htmlFor="installer_address" className="sm:col-span-2">
          <Input id="installer_address" name="installer_address" defaultValue={part?.installer_address ?? ""} />
        </Field>
        <Field label="Installation notes" htmlFor="install_notes" className="sm:col-span-2">
          <Textarea id="install_notes" name="install_notes" defaultValue={part?.install_notes ?? ""} />
        </Field>
      </FormSection>

      <FormSection title="Cost" description={total != null ? `Total installed cost ${formatMoney(total)}` : undefined}>
        <Field label="Part cost" htmlFor="part_cost">
          <MoneyInput id="part_cost" name="part_cost" value={costs.part_cost} onChange={onChange("part_cost")} placeholder="0.00" />
        </Field>
        <Field label="Labor cost" htmlFor="labor_cost">
          <MoneyInput id="labor_cost" name="labor_cost" value={costs.labor_cost} onChange={onChange("labor_cost")} placeholder="0.00" />
        </Field>
        <Field label="Shipping" htmlFor="shipping_cost">
          <MoneyInput id="shipping_cost" name="shipping_cost" value={costs.shipping_cost} onChange={onChange("shipping_cost")} placeholder="0.00" />
        </Field>
        <Field label="Tax" htmlFor="tax">
          <MoneyInput id="tax" name="tax" value={costs.tax} onChange={onChange("tax")} placeholder="0.00" />
        </Field>
        <p className="sm:col-span-2 rounded-lg border border-line bg-raised px-3 py-2 text-sm">
          <span className="text-muted">Total installed cost: </span>
          <span className="font-bold tabular-nums text-ink">{formatMoney(total)}</span>
        </p>
      </FormSection>

      <FormSection title="Purchase" collapsible defaultOpen={false} description="Vendor, order number and date">
        <Field label="Vendor / seller" htmlFor="purchase_vendor">
          <Input id="purchase_vendor" name="purchase_vendor" defaultValue={part?.purchase_vendor ?? ""} placeholder="Rocky Mountain ATV" />
        </Field>
        <Field label="Purchase location" htmlFor="purchase_location" hint="Store, website or address.">
          <Input id="purchase_location" name="purchase_location" defaultValue={part?.purchase_location ?? ""} />
        </Field>
        <Field label="Purchase date" htmlFor="purchased_on">
          <Input id="purchased_on" name="purchased_on" type="date" defaultValue={part?.purchased_on ?? ""} />
        </Field>
        <Field label="Order / invoice number" htmlFor="order_number">
          <Input id="order_number" name="order_number" defaultValue={part?.order_number ?? ""} />
        </Field>
      </FormSection>

      <FormSection
        title="Warranty"
        collapsible
        defaultOpen={false}
        description="Term, mileage and hour limits"
      >
        <Field label="Warranty type" htmlFor="warranty_type">
          <Select id="warranty_type" name="warranty_type" options={WARRANTY_OPTIONS} defaultValue={part?.warranty_type ?? "NONE"} />
        </Field>
        <Field label="Warranty provider" htmlFor="warranty_provider">
          <Input id="warranty_provider" name="warranty_provider" defaultValue={part?.warranty_provider ?? ""} />
        </Field>
        <Field label="Length in months" htmlFor="warranty_months" hint="48 for a 4 year warranty.">
          <Input id="warranty_months" name="warranty_months" inputMode="numeric" defaultValue={part?.warranty_months ?? ""} />
        </Field>
        <Field label="Mileage limit" htmlFor="warranty_miles" hint="Miles of cover from the install reading.">
          <Input id="warranty_miles" name="warranty_miles" inputMode="numeric" defaultValue={part?.warranty_miles ?? ""} />
        </Field>
        <Field label="Engine-hour limit" htmlFor="warranty_hours">
          <Input id="warranty_hours" name="warranty_hours" inputMode="decimal" defaultValue={part?.warranty_hours ?? ""} />
        </Field>
        <Field label="Expiry date" htmlFor="warranty_expires_on" hint="Overrides the calculated term.">
          <Input id="warranty_expires_on" name="warranty_expires_on" type="date" defaultValue={part?.warranty_expires_on ?? ""} />
        </Field>
        <Field label="Warranty notes" htmlFor="warranty_notes" className="sm:col-span-2">
          <Textarea id="warranty_notes" name="warranty_notes" defaultValue={part?.warranty_notes ?? ""} />
        </Field>
      </FormSection>

      {showSchedule ? (
        <FormSection
          title="Maintenance schedule"
          description="Optional — set an interval and the next service is calculated for you."
          collapsible
          defaultOpen={false}
        >
          <Field label="Task" htmlFor="schedule_task_type">
            <Select id="schedule_task_type" name="schedule_task_type" options={TASK_OPTIONS} />
          </Field>
          <Field label="Label" htmlFor="schedule_label" hint="e.g. Clean and re-oil filter">
            <Input id="schedule_label" name="schedule_label" />
          </Field>
          {tracksMiles ? (
            <Field label="Every … miles" htmlFor="schedule_interval_miles">
              <Input id="schedule_interval_miles" name="schedule_interval_miles" inputMode="numeric" placeholder="5000" />
            </Field>
          ) : null}
          {tracksHours ? (
            <Field label="Every … engine hours" htmlFor="schedule_interval_hours">
              <Input id="schedule_interval_hours" name="schedule_interval_hours" inputMode="decimal" placeholder="50" />
            </Field>
          ) : null}
          <Field label="Every … months" htmlFor="schedule_interval_months">
            <Input id="schedule_interval_months" name="schedule_interval_months" inputMode="numeric" placeholder="12" />
          </Field>
          <Field label="When several intervals are set" htmlFor="schedule_trigger_mode">
            <Select
              id="schedule_trigger_mode"
              name="schedule_trigger_mode"
              options={[
                { value: "FIRST", label: "Due at whichever comes first" },
                { value: "LAST", label: "Due only when all have elapsed" },
              ]}
            />
          </Field>
          <Field label="Schedule notes" htmlFor="schedule_notes" className="sm:col-span-2">
            <Textarea id="schedule_notes" name="schedule_notes" rows={2} />
          </Field>
        </FormSection>
      ) : null}

      <FormSection title="Receipts & photos" collapsible defaultOpen={false} description="Images or PDF, up to 20 MB each">
        <Field label="File type" htmlFor="file_kind">
          <Select
            id="file_kind"
            name="file_kind"
            options={[
              { value: "PHOTO", label: "Photo" },
              { value: "RECEIPT", label: "Receipt" },
              { value: "INVOICE", label: "Invoice" },
              { value: "MANUAL", label: "Manual / Instructions" },
              { value: "WARRANTY", label: "Warranty document" },
              { value: "OTHER", label: "Other document" },
            ]}
          />
        </Field>
        <Field label="Caption" htmlFor="file_caption">
          <Input id="file_caption" name="file_caption" />
        </Field>
        <Field label="Files" htmlFor="files" className="sm:col-span-2">
          <Input id="files" name="files" type="file" multiple accept="image/*,application/pdf" />
        </Field>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={4} defaultValue={part?.notes ?? ""} />
        </Field>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
