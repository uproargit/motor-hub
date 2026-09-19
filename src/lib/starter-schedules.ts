/**
 * Common factory maintenance intervals, offered as a starting point when a
 * vehicle is new. These are generic figures, not any manufacturer's published
 * schedule — they exist so a vehicle can be set up in one pass and the numbers
 * corrected against the owner's manual afterwards.
 *
 * Every preset becomes an ordinary part row with the build-sheet flag off, plus
 * one schedule, so nothing here is a special case for the rest of the app to
 * understand. Pure: no database access, so the selection logic is unit tested.
 */

import type { PartCategory, TaskType, TriggerMode, VehicleType } from "./domain";
import type { VehicleRow } from "./types";

export interface StarterSchedule {
  /** Stable across releases: it is the checkbox value in the setup form. */
  key: string;
  part_name: string;
  category: PartCategory;
  task_type: TaskType;
  label: string;
  interval_miles: number | null;
  interval_hours: number | null;
  interval_months: number | null;
  trigger_mode: TriggerMode;
}

type Preset = Omit<StarterSchedule, "interval_miles" | "interval_hours" | "interval_months" | "trigger_mode"> & {
  interval_miles?: number;
  interval_hours?: number;
  interval_months?: number;
  trigger_mode?: TriggerMode;
};

/** Road vehicles: everything keys off the odometer, with a calendar backstop. */
const ROAD: Preset[] = [
  {
    key: "oil-change",
    part_name: "Engine oil & filter",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Change oil and filter",
    interval_miles: 5000,
    interval_months: 12,
  },
  {
    key: "tire-rotation",
    part_name: "Tires",
    category: "TIRES",
    task_type: "ROTATE",
    label: "Rotate tires",
    interval_miles: 7500,
  },
  {
    key: "engine-air-filter",
    part_name: "Engine air filter",
    category: "FILTERS",
    task_type: "REPLACE",
    label: "Replace engine air filter",
    interval_miles: 20000,
  },
  {
    key: "cabin-air-filter",
    part_name: "Cabin air filter",
    category: "FILTERS",
    task_type: "REPLACE",
    label: "Replace cabin air filter",
    interval_miles: 20000,
    interval_months: 12,
  },
  {
    key: "brake-inspection",
    part_name: "Brakes",
    category: "BRAKES",
    task_type: "INSPECT",
    label: "Inspect pads and rotors",
    interval_miles: 10000,
    interval_months: 12,
  },
  {
    key: "brake-fluid",
    part_name: "Brake fluid",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Flush brake fluid",
    interval_months: 24,
  },
  {
    key: "coolant",
    part_name: "Engine coolant",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Replace coolant",
    interval_miles: 60000,
    interval_months: 60,
  },
  {
    key: "spark-plugs",
    part_name: "Spark plugs",
    category: "ENGINE",
    task_type: "REPLACE",
    label: "Replace spark plugs",
    interval_miles: 60000,
  },
  {
    key: "transmission-fluid",
    part_name: "Transmission fluid",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Replace transmission fluid",
    interval_miles: 60000,
  },
  {
    key: "wiper-blades",
    part_name: "Wiper blades",
    category: "CONSUMABLES",
    task_type: "REPLACE",
    label: "Replace wiper blades",
    interval_months: 12,
  },
];

/** UTV, ATV, snowmobile: hour meter first, odometer second where fitted. */
const POWERSPORTS: Preset[] = [
  {
    key: "ps-oil-change",
    part_name: "Engine oil & filter",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Change oil and filter",
    interval_hours: 100,
    interval_miles: 1000,
    interval_months: 12,
  },
  {
    key: "ps-air-filter",
    part_name: "Engine air filter",
    category: "FILTERS",
    task_type: "CLEAN",
    label: "Clean or replace air filter",
    interval_hours: 25,
  },
  {
    key: "ps-drive-belt",
    part_name: "Drive belt",
    category: "DRIVETRAIN",
    task_type: "INSPECT",
    label: "Inspect drive belt",
    interval_hours: 50,
  },
  {
    key: "ps-spark-plug",
    part_name: "Spark plugs",
    category: "ENGINE",
    task_type: "REPLACE",
    label: "Replace spark plugs",
    interval_hours: 100,
  },
  {
    key: "ps-grease",
    part_name: "Chassis grease points",
    category: "CHASSIS",
    task_type: "LUBRICATE",
    label: "Grease fittings",
    interval_hours: 25,
  },
  {
    key: "ps-coolant",
    part_name: "Engine coolant",
    category: "COOLING",
    task_type: "REPLACE",
    label: "Replace coolant",
    interval_months: 24,
  },
];

/** Boats and PWC: hours and the calendar, never miles. */
const MARINE: Preset[] = [
  {
    key: "marine-oil-change",
    part_name: "Engine oil & filter",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Change oil and filter",
    interval_hours: 100,
    interval_months: 12,
  },
  {
    key: "marine-impeller",
    part_name: "Water pump impeller",
    category: "COOLING",
    task_type: "REPLACE",
    label: "Replace impeller",
    interval_months: 12,
  },
  {
    key: "marine-gear-oil",
    part_name: "Lower unit gear oil",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Replace gear oil",
    interval_hours: 100,
    interval_months: 12,
  },
  {
    key: "marine-fuel-filter",
    part_name: "Fuel filter / water separator",
    category: "FILTERS",
    task_type: "REPLACE",
    label: "Replace fuel filter",
    interval_hours: 100,
    interval_months: 12,
  },
  {
    key: "marine-anodes",
    part_name: "Sacrificial anodes",
    category: "CONSUMABLES",
    task_type: "INSPECT",
    label: "Inspect anodes",
    interval_months: 6,
  },
  {
    key: "marine-spark-plugs",
    part_name: "Spark plugs",
    category: "ENGINE",
    task_type: "REPLACE",
    label: "Replace spark plugs",
    interval_hours: 100,
  },
];

/** Tractors and equipment: hours, with hydraulics on a long interval. */
const EQUIPMENT: Preset[] = [
  {
    key: "eq-oil-change",
    part_name: "Engine oil & filter",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Change oil and filter",
    interval_hours: 100,
    interval_months: 12,
  },
  {
    key: "eq-air-filter",
    part_name: "Engine air filter",
    category: "FILTERS",
    task_type: "CLEAN",
    label: "Clean or replace air filter",
    interval_hours: 50,
  },
  {
    key: "eq-hydraulic-fluid",
    part_name: "Hydraulic fluid & filter",
    category: "FLUIDS",
    task_type: "REPLACE",
    label: "Replace hydraulic fluid and filter",
    interval_hours: 200,
    interval_months: 24,
  },
  {
    key: "eq-fuel-filter",
    part_name: "Fuel filter",
    category: "FILTERS",
    task_type: "REPLACE",
    label: "Replace fuel filter",
    interval_hours: 200,
  },
  {
    key: "eq-grease",
    part_name: "Grease points",
    category: "CHASSIS",
    task_type: "LUBRICATE",
    label: "Grease fittings",
    interval_hours: 50,
  },
];

/** Towed and anything unclassified: calendar work plus bearings if it rolls. */
const TOWED: Preset[] = [
  {
    key: "towed-bearings",
    part_name: "Wheel bearings",
    category: "WHEELS",
    task_type: "SERVICE",
    label: "Repack wheel bearings",
    interval_miles: 12000,
    interval_months: 12,
  },
  {
    key: "towed-tires",
    part_name: "Tires",
    category: "TIRES",
    task_type: "INSPECT",
    label: "Inspect tires and pressures",
    interval_months: 6,
  },
  {
    key: "towed-lights",
    part_name: "Lighting & wiring",
    category: "LIGHTING",
    task_type: "INSPECT",
    label: "Inspect lights and wiring",
    interval_months: 6,
  },
  {
    key: "towed-brakes",
    part_name: "Brakes",
    category: "BRAKES",
    task_type: "INSPECT",
    label: "Inspect brakes",
    interval_months: 12,
  },
];

const GENERIC: Preset[] = [
  {
    key: "generic-service",
    part_name: "Annual service",
    category: "OTHER",
    task_type: "SERVICE",
    label: "General service",
    interval_months: 12,
  },
  {
    key: "generic-inspection",
    part_name: "General inspection",
    category: "OTHER",
    task_type: "INSPECT",
    label: "Look it over",
    interval_months: 6,
  },
];

const BY_TYPE: Record<VehicleType, Preset[]> = {
  CAR: ROAD,
  TRUCK: ROAD,
  SUV: ROAD,
  RV: ROAD,
  MOTORCYCLE: ROAD,
  UTV: POWERSPORTS,
  ATV: POWERSPORTS,
  SNOWMOBILE: POWERSPORTS,
  BOAT: MARINE,
  PWC: MARINE,
  EQUIPMENT: EQUIPMENT,
  TRAILER: TOWED,
  OTHER: GENERIC,
};

/**
 * The presets worth offering this vehicle: its type's list, with the intervals
 * it cannot measure removed. A preset that loses every interval that way is
 * dropped rather than offered as something that would never come due — tire
 * rotation on a boat is nothing but noise.
 */
export function starterSchedulesFor(
  vehicle: Pick<VehicleRow, "vehicle_type" | "tracks_mileage" | "tracks_engine_hours">,
): StarterSchedule[] {
  const presets = BY_TYPE[vehicle.vehicle_type] ?? GENERIC;
  const tracksMileage = vehicle.tracks_mileage === 1;
  const tracksHours = vehicle.tracks_engine_hours === 1;

  const offered = presets.map((preset) => ({
    key: preset.key,
    part_name: preset.part_name,
    category: preset.category,
    task_type: preset.task_type,
    label: preset.label,
    interval_miles: tracksMileage ? (preset.interval_miles ?? null) : null,
    interval_hours: tracksHours ? (preset.interval_hours ?? null) : null,
    interval_months: preset.interval_months ?? null,
    trigger_mode: preset.trigger_mode ?? ("FIRST" as TriggerMode),
  }));

  return offered.filter(
    (preset) =>
      preset.interval_miles != null || preset.interval_hours != null || preset.interval_months != null,
  );
}

/** Every preset key the app knows, so a submitted form can be validated. */
export function isStarterScheduleKey(key: string): boolean {
  return Object.values(BY_TYPE).some((presets) => presets.some((preset) => preset.key === key));
}
