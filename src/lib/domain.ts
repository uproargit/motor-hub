/**
 * Domain vocabulary for Motor Hub: vehicle kinds, part categories, statuses and
 * the groupings the build sheet is organised by.
 */

export type VehicleType =
  | "CAR"
  | "TRUCK"
  | "SUV"
  | "MOTORCYCLE"
  | "UTV"
  | "ATV"
  | "BOAT"
  | "PWC"
  | "RV"
  | "TRAILER"
  | "SNOWMOBILE"
  | "EQUIPMENT"
  | "OTHER";

/** Defaults describe which meters the machine usually has. */
export const VEHICLE_TYPES: Record<
  VehicleType,
  { label: string; icon: string; tracksMileage: boolean; tracksEngineHours: boolean }
> = {
  CAR: { label: "Car", icon: "🚗", tracksMileage: true, tracksEngineHours: false },
  TRUCK: { label: "Truck", icon: "🛻", tracksMileage: true, tracksEngineHours: false },
  SUV: { label: "SUV", icon: "🚙", tracksMileage: true, tracksEngineHours: false },
  MOTORCYCLE: { label: "Motorcycle", icon: "🏍️", tracksMileage: true, tracksEngineHours: false },
  UTV: { label: "UTV / Side-by-Side", icon: "🏜️", tracksMileage: true, tracksEngineHours: true },
  ATV: { label: "ATV / Quad", icon: "🛞", tracksMileage: true, tracksEngineHours: true },
  BOAT: { label: "Boat", icon: "🛥️", tracksMileage: false, tracksEngineHours: true },
  PWC: { label: "Personal Watercraft", icon: "🌊", tracksMileage: false, tracksEngineHours: true },
  RV: { label: "RV / Motorhome", icon: "🚐", tracksMileage: true, tracksEngineHours: true },
  TRAILER: { label: "Trailer", icon: "🚛", tracksMileage: true, tracksEngineHours: false },
  SNOWMOBILE: { label: "Snowmobile", icon: "🛷", tracksMileage: true, tracksEngineHours: true },
  EQUIPMENT: { label: "Equipment / Tractor", icon: "🚜", tracksMileage: false, tracksEngineHours: true },
  OTHER: { label: "Other", icon: "⚙️", tracksMileage: true, tracksEngineHours: false },
};

export const VEHICLE_TYPE_KEYS = Object.keys(VEHICLE_TYPES) as VehicleType[];

/** Build-sheet sections. Categories roll up into these. */
export type CategoryGroup =
  | "WHEELS_TIRES"
  | "SUSPENSION_CHASSIS"
  | "PERFORMANCE"
  | "BRAKING"
  | "LIGHTING_ELECTRICAL"
  | "EXTERIOR"
  | "INTERIOR"
  | "UTILITY"
  | "MAINTENANCE"
  | "OTHER";

export const CATEGORY_GROUPS: Record<CategoryGroup, { label: string; icon: string }> = {
  WHEELS_TIRES: { label: "Wheels & Tires", icon: "🛞" },
  SUSPENSION_CHASSIS: { label: "Suspension & Chassis", icon: "🔧" },
  PERFORMANCE: { label: "Performance & Drivetrain", icon: "⚡" },
  BRAKING: { label: "Braking", icon: "🛑" },
  LIGHTING_ELECTRICAL: { label: "Lighting & Electrical", icon: "💡" },
  EXTERIOR: { label: "Exterior & Protection", icon: "🛡️" },
  INTERIOR: { label: "Interior", icon: "🪑" },
  UTILITY: { label: "Utility & Recovery", icon: "🪝" },
  MAINTENANCE: { label: "Maintenance & Consumables", icon: "🧰" },
  OTHER: { label: "Other", icon: "📦" },
};

export const CATEGORY_GROUP_ORDER: CategoryGroup[] = [
  "WHEELS_TIRES",
  "SUSPENSION_CHASSIS",
  "PERFORMANCE",
  "BRAKING",
  "LIGHTING_ELECTRICAL",
  "EXTERIOR",
  "INTERIOR",
  "UTILITY",
  "MAINTENANCE",
  "OTHER",
];

export type PartCategory =
  | "WHEELS"
  | "TIRES"
  | "SUSPENSION"
  | "STEERING"
  | "CHASSIS"
  | "ENGINE"
  | "INTAKE"
  | "EXHAUST"
  | "FUEL"
  | "COOLING"
  | "TUNING"
  | "DRIVETRAIN"
  | "BRAKES"
  | "LIGHTING"
  | "ELECTRONICS"
  | "ELECTRICAL"
  | "AUDIO"
  | "INTERIOR"
  | "SEATS_SAFETY"
  | "EXTERIOR"
  | "ARMOR"
  | "RECOVERY"
  | "STORAGE"
  | "ACCESSORIES"
  | "FILTERS"
  | "FLUIDS"
  | "CONSUMABLES"
  | "OTHER";

export const PART_CATEGORIES: Record<PartCategory, { label: string; group: CategoryGroup }> = {
  WHEELS: { label: "Wheels", group: "WHEELS_TIRES" },
  TIRES: { label: "Tires", group: "WHEELS_TIRES" },
  SUSPENSION: { label: "Suspension", group: "SUSPENSION_CHASSIS" },
  STEERING: { label: "Steering", group: "SUSPENSION_CHASSIS" },
  CHASSIS: { label: "Chassis & Frame", group: "SUSPENSION_CHASSIS" },
  ENGINE: { label: "Engine", group: "PERFORMANCE" },
  INTAKE: { label: "Intake", group: "PERFORMANCE" },
  EXHAUST: { label: "Exhaust", group: "PERFORMANCE" },
  FUEL: { label: "Fuel System", group: "PERFORMANCE" },
  COOLING: { label: "Cooling", group: "PERFORMANCE" },
  TUNING: { label: "ECU & Tuning", group: "PERFORMANCE" },
  DRIVETRAIN: { label: "Drivetrain", group: "PERFORMANCE" },
  BRAKES: { label: "Brakes", group: "BRAKING" },
  LIGHTING: { label: "Lighting", group: "LIGHTING_ELECTRICAL" },
  ELECTRONICS: { label: "Electronics", group: "LIGHTING_ELECTRICAL" },
  ELECTRICAL: { label: "Electrical & Charging", group: "LIGHTING_ELECTRICAL" },
  AUDIO: { label: "Audio", group: "LIGHTING_ELECTRICAL" },
  INTERIOR: { label: "Interior", group: "INTERIOR" },
  SEATS_SAFETY: { label: "Seats & Safety", group: "INTERIOR" },
  EXTERIOR: { label: "Exterior & Body", group: "EXTERIOR" },
  ARMOR: { label: "Armor & Protection", group: "EXTERIOR" },
  RECOVERY: { label: "Recovery & Towing", group: "UTILITY" },
  STORAGE: { label: "Storage & Racks", group: "UTILITY" },
  ACCESSORIES: { label: "Accessories", group: "UTILITY" },
  FILTERS: { label: "Filters", group: "MAINTENANCE" },
  FLUIDS: { label: "Fluids & Lubricants", group: "MAINTENANCE" },
  CONSUMABLES: { label: "Belts & Consumables", group: "MAINTENANCE" },
  OTHER: { label: "Other", group: "OTHER" },
};

export const PART_CATEGORY_KEYS = (Object.keys(PART_CATEGORIES) as PartCategory[]).sort((a, b) =>
  PART_CATEGORIES[a].label.localeCompare(PART_CATEGORIES[b].label),
);

export function categoryLabel(category: string): string {
  return PART_CATEGORIES[category as PartCategory]?.label ?? category;
}

export function categoryGroupOf(category: string): CategoryGroup {
  return PART_CATEGORIES[category as PartCategory]?.group ?? "OTHER";
}

export type PartStatus =
  | "INSTALLED"
  | "REMOVED"
  | "REPLACED"
  | "SOLD"
  | "DAMAGED"
  | "FAILED"
  | "IN_STORAGE"
  | "ON_ORDER"
  | "PLANNED";

export const PART_STATUSES: Record<
  PartStatus,
  { label: string; tone: "good" | "warn" | "bad" | "muted" | "info"; onVehicle: boolean }
> = {
  INSTALLED: { label: "Installed", tone: "good", onVehicle: true },
  REMOVED: { label: "Removed", tone: "muted", onVehicle: false },
  REPLACED: { label: "Replaced", tone: "muted", onVehicle: false },
  SOLD: { label: "Sold", tone: "muted", onVehicle: false },
  DAMAGED: { label: "Damaged", tone: "warn", onVehicle: false },
  FAILED: { label: "Failed", tone: "bad", onVehicle: false },
  IN_STORAGE: { label: "In Storage", tone: "muted", onVehicle: false },
  ON_ORDER: { label: "On Order", tone: "info", onVehicle: false },
  PLANNED: { label: "Planned", tone: "info", onVehicle: false },
};

export const PART_STATUS_KEYS = Object.keys(PART_STATUSES) as PartStatus[];

export type InstalledBy =
  | "SELF"
  | "SHOP"
  | "DEALER"
  | "MANUFACTURER"
  | "FRIEND"
  | "PREVIOUS_OWNER"
  | "FACTORY"
  | "OTHER";

export const INSTALLED_BY: Record<InstalledBy, string> = {
  SELF: "Self",
  SHOP: "Shop",
  DEALER: "Dealer",
  MANUFACTURER: "Manufacturer",
  FRIEND: "Friend",
  PREVIOUS_OWNER: "Previous owner",
  FACTORY: "Factory / OEM",
  OTHER: "Other",
};

export const INSTALLED_BY_KEYS = Object.keys(INSTALLED_BY) as InstalledBy[];

export type WarrantyType = "NONE" | "MANUFACTURER" | "LIMITED" | "LIFETIME" | "EXTENDED" | "SHOP";

export const WARRANTY_TYPES: Record<WarrantyType, string> = {
  NONE: "No warranty",
  MANUFACTURER: "Manufacturer",
  LIMITED: "Limited",
  LIFETIME: "Lifetime",
  EXTENDED: "Extended",
  SHOP: "Shop / installer",
};

export const WARRANTY_TYPE_KEYS = Object.keys(WARRANTY_TYPES) as WarrantyType[];

export type TaskType =
  | "INSPECT"
  | "REPLACE"
  | "SERVICE"
  | "CLEAN"
  | "ROTATE"
  | "ADJUST"
  | "LUBRICATE"
  | "TORQUE"
  | "REBUILD"
  | "ALIGN"
  | "OTHER";

export const TASK_TYPES: Record<TaskType, { label: string; verb: string }> = {
  INSPECT: { label: "Inspection", verb: "Inspect" },
  REPLACE: { label: "Replacement", verb: "Replace" },
  SERVICE: { label: "Service", verb: "Service" },
  CLEAN: { label: "Cleaning", verb: "Clean" },
  ROTATE: { label: "Rotation", verb: "Rotate" },
  ADJUST: { label: "Adjustment", verb: "Adjust" },
  LUBRICATE: { label: "Lubrication", verb: "Lubricate" },
  TORQUE: { label: "Torque check", verb: "Re-torque" },
  REBUILD: { label: "Rebuild", verb: "Rebuild" },
  ALIGN: { label: "Alignment", verb: "Align" },
  OTHER: { label: "Service", verb: "Service" },
};

export const TASK_TYPE_KEYS = Object.keys(TASK_TYPES) as TaskType[];

export type AttachmentKind = "PHOTO" | "RECEIPT" | "INVOICE" | "MANUAL" | "WARRANTY" | "OTHER";

export const ATTACHMENT_KINDS: Record<AttachmentKind, string> = {
  PHOTO: "Photo",
  RECEIPT: "Receipt",
  INVOICE: "Invoice",
  MANUAL: "Manual / Instructions",
  WARRANTY: "Warranty document",
  OTHER: "Other document",
};

export const ATTACHMENT_KIND_KEYS = Object.keys(ATTACHMENT_KINDS) as AttachmentKind[];

export type TriggerMode = "FIRST" | "LAST";

export type Disposition = "KEPT" | "SOLD" | "SCRAPPED" | "RETURNED" | "WARRANTY_CLAIM" | "SHELF";

export const DISPOSITIONS: Record<Disposition, string> = {
  KEPT: "Kept",
  SOLD: "Sold",
  SCRAPPED: "Scrapped",
  RETURNED: "Returned to vendor",
  WARRANTY_CLAIM: "Warranty claim",
  SHELF: "On the shelf / spare",
};

export const DISPOSITION_KEYS = Object.keys(DISPOSITIONS) as Disposition[];
