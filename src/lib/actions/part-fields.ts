import "server-only";

import { enums, optionalDate, parse, requiredText } from "./shared";

/** Every column of `part` that the create/edit form is allowed to set. */
export interface PartFields {
  name: string;
  category: string;
  manufacturer: string | null;
  part_number: string | null;
  description: string | null;
  quantity: number;
  is_modification: number;
  is_oem: number;
  status: string;
  installed_on: string | null;
  installed_mileage: number | null;
  installed_hours: number | null;
  installed_by: string;
  installer_name: string | null;
  installer_phone: string | null;
  installer_email: string | null;
  installer_address: string | null;
  install_notes: string | null;
  part_cost_cents: number | null;
  labor_cost_cents: number | null;
  shipping_cost_cents: number | null;
  tax_cents: number | null;
  purchase_vendor: string | null;
  purchase_location: string | null;
  purchased_on: string | null;
  order_number: string | null;
  warranty_type: string;
  warranty_provider: string | null;
  warranty_months: number | null;
  warranty_miles: number | null;
  warranty_hours: number | null;
  warranty_expires_on: string | null;
  warranty_notes: string | null;
  notes: string | null;
}

export function partFieldsFrom(formData: FormData): PartFields {
  const quantity = parse.float(formData.get("quantity"));

  return {
    name: requiredText(formData.get("name"), "Part name"),
    category: enums.category(formData.get("category")),
    manufacturer: parse.text(formData.get("manufacturer")),
    part_number: parse.text(formData.get("part_number")),
    description: parse.text(formData.get("description")),
    quantity: quantity != null && quantity > 0 ? quantity : 1,
    is_modification: parse.flag(formData.get("is_modification")),
    is_oem: parse.flag(formData.get("is_oem")),
    status: enums.status(formData.get("status")),

    installed_on: optionalDate(formData.get("installed_on"), "Date installed"),
    installed_mileage: parse.int(formData.get("installed_mileage")),
    installed_hours: parse.float(formData.get("installed_hours")),
    installed_by: enums.installedBy(formData.get("installed_by")),
    installer_name: parse.text(formData.get("installer_name")),
    installer_phone: parse.text(formData.get("installer_phone")),
    installer_email: parse.text(formData.get("installer_email")),
    installer_address: parse.text(formData.get("installer_address")),
    install_notes: parse.text(formData.get("install_notes")),

    part_cost_cents: parse.money(formData.get("part_cost")),
    labor_cost_cents: parse.money(formData.get("labor_cost")),
    shipping_cost_cents: parse.money(formData.get("shipping_cost")),
    tax_cents: parse.money(formData.get("tax")),

    purchase_vendor: parse.text(formData.get("purchase_vendor")),
    purchase_location: parse.text(formData.get("purchase_location")),
    purchased_on: optionalDate(formData.get("purchased_on"), "Purchase date"),
    order_number: parse.text(formData.get("order_number")),

    warranty_type: enums.warranty(formData.get("warranty_type")),
    warranty_provider: parse.text(formData.get("warranty_provider")),
    warranty_months: parse.int(formData.get("warranty_months")),
    warranty_miles: parse.int(formData.get("warranty_miles")),
    warranty_hours: parse.float(formData.get("warranty_hours")),
    warranty_expires_on: optionalDate(formData.get("warranty_expires_on"), "Warranty expiry"),
    warranty_notes: parse.text(formData.get("warranty_notes")),

    notes: parse.text(formData.get("notes")),
  };
}

export const PART_COLUMNS = Object.keys(partFieldsTemplate()) as Array<keyof PartFields>;

function partFieldsTemplate(): Record<keyof PartFields, null> {
  return {
    name: null,
    category: null,
    manufacturer: null,
    part_number: null,
    description: null,
    quantity: null,
    is_modification: null,
    is_oem: null,
    status: null,
    installed_on: null,
    installed_mileage: null,
    installed_hours: null,
    installed_by: null,
    installer_name: null,
    installer_phone: null,
    installer_email: null,
    installer_address: null,
    install_notes: null,
    part_cost_cents: null,
    labor_cost_cents: null,
    shipping_cost_cents: null,
    tax_cents: null,
    purchase_vendor: null,
    purchase_location: null,
    purchased_on: null,
    order_number: null,
    warranty_type: null,
    warranty_provider: null,
    warranty_months: null,
    warranty_miles: null,
    warranty_hours: null,
    warranty_expires_on: null,
    warranty_notes: null,
    notes: null,
  };
}

/**
 * An optional maintenance schedule entered alongside a new part, e.g. the
 * "inspect every 50 hours" attached to a drive belt at install time.
 */
export interface InlineSchedule {
  task_type: string;
  label: string | null;
  interval_miles: number | null;
  interval_hours: number | null;
  interval_months: number | null;
  trigger_mode: string;
  notes: string | null;
}

export function inlineScheduleFrom(formData: FormData, prefix = "schedule_"): InlineSchedule | null {
  const miles = parse.int(formData.get(`${prefix}interval_miles`));
  const hours = parse.float(formData.get(`${prefix}interval_hours`));
  const months = parse.int(formData.get(`${prefix}interval_months`));

  // No interval means no schedule was requested.
  if (!miles && !hours && !months) return null;

  return {
    task_type: enums.task(formData.get(`${prefix}task_type`)),
    label: parse.text(formData.get(`${prefix}label`)),
    interval_miles: miles && miles > 0 ? miles : null,
    interval_hours: hours && hours > 0 ? hours : null,
    interval_months: months && months > 0 ? months : null,
    trigger_mode: enums.triggerMode(formData.get(`${prefix}trigger_mode`)),
    notes: parse.text(formData.get(`${prefix}notes`)),
  };
}
