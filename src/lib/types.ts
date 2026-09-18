import type {
  AttachmentKind,
  Disposition,
  InstalledBy,
  PartCategory,
  PartStatus,
  TaskType,
  TriggerMode,
  VehicleType,
  WarrantyType,
} from "./domain";

export interface VehicleRow {
  id: string;
  nickname: string | null;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  vehicle_type: VehicleType;
  vin: string | null;
  plate: string | null;
  color: string | null;
  purchased_on: string | null;
  purchase_price_cents: number | null;
  tracks_mileage: number;
  tracks_engine_hours: number;
  current_mileage: number | null;
  current_engine_hours: number | null;
  usage_updated_on: string | null;
  notes: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface PartRow {
  id: string;
  vehicle_id: string;
  name: string;
  category: PartCategory;
  manufacturer: string | null;
  part_number: string | null;
  description: string | null;
  quantity: number;
  is_modification: number;
  is_oem: number;
  status: PartStatus;
  installed_on: string | null;
  installed_mileage: number | null;
  installed_hours: number | null;
  installed_by: InstalledBy;
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
  warranty_type: WarrantyType;
  warranty_provider: string | null;
  warranty_months: number | null;
  warranty_miles: number | null;
  warranty_hours: number | null;
  warranty_expires_on: string | null;
  warranty_notes: string | null;
  removed_on: string | null;
  removed_mileage: number | null;
  removed_hours: number | null;
  removal_reason: string | null;
  disposition: Disposition | null;
  sale_price_cents: number | null;
  replaces_part_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRow {
  id: string;
  part_id: string;
  task_type: TaskType;
  label: string | null;
  interval_miles: number | null;
  interval_hours: number | null;
  interval_months: number | null;
  trigger_mode: TriggerMode;
  base_mileage: number | null;
  base_hours: number | null;
  base_on: string | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecordRow {
  id: string;
  part_id: string;
  schedule_id: string | null;
  task_type: TaskType;
  performed_on: string;
  mileage: number | null;
  engine_hours: number | null;
  performed_by: InstalledBy;
  performer_name: string | null;
  cost_cents: number | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  vehicle_id: string | null;
  part_id: string | null;
  service_record_id: string | null;
  kind: AttachmentKind;
  file_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  created_at: string;
}

export interface UsageReadingRow {
  id: string;
  vehicle_id: string;
  recorded_on: string;
  mileage: number | null;
  engine_hours: number | null;
  source: string;
  notes: string | null;
  created_at: string;
}

/** Current usage snapshot used to evaluate maintenance schedules. */
export interface UsageSnapshot {
  mileage: number | null;
  engineHours: number | null;
  /** ISO date, 'YYYY-MM-DD'. */
  today: string;
}
