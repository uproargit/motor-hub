/**
 * Pure derivations over a part row: installed cost and warranty standing.
 */

import { addMonths, formatDate, isValidIsoDate } from "./dates";
import { PART_STATUSES } from "./domain";
import type { PartRow, UsageSnapshot, VehicleRow } from "./types";

export function sumCents(...values: Array<number | null | undefined>): number | null {
  const present = values.filter((value): value is number => value != null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0);
}

/** Part + labor + shipping + tax. Null only when nothing at all was recorded. */
export function totalInstalledCents(part: PartRow): number | null {
  return sumCents(part.part_cost_cents, part.labor_cost_cents, part.shipping_cost_cents, part.tax_cents);
}

export function isOnVehicle(part: PartRow): boolean {
  return PART_STATUSES[part.status]?.onVehicle ?? false;
}

export type WarrantyState = "NONE" | "ACTIVE" | "EXPIRED" | "LIFETIME" | "UNKNOWN";

export interface WarrantyStanding {
  state: WarrantyState;
  expiresOn: string | null;
  /** Limits that have been exceeded, or are configured but not yet reached. */
  reasons: string[];
  summary: string;
}

/**
 * Works out whether a part is still under warranty. Warranties can be limited
 * by time, mileage and engine hours at once, and any one of them expiring ends
 * the cover.
 */
export function warrantyStanding(part: PartRow, usage: UsageSnapshot): WarrantyStanding {
  if (part.warranty_type === "NONE") {
    return { state: "NONE", expiresOn: null, reasons: [], summary: "No warranty" };
  }

  const expiresOn =
    part.warranty_expires_on ??
    (part.warranty_months != null && isValidIsoDate(part.installed_on)
      ? addMonths(part.installed_on, part.warranty_months)
      : null);

  const reasons: string[] = [];
  let expired = false;
  let evaluated = false;

  if (isValidIsoDate(expiresOn)) {
    evaluated = true;
    if (expiresOn < usage.today) {
      expired = true;
      reasons.push(`Term ended ${formatDate(expiresOn)}`);
    } else {
      reasons.push(`Covered until ${formatDate(expiresOn)}`);
    }
  }

  if (part.warranty_miles != null && part.installed_mileage != null && usage.mileage != null) {
    evaluated = true;
    const limit = part.installed_mileage + part.warranty_miles;
    if (usage.mileage > limit) {
      expired = true;
      reasons.push(`Past ${limit.toLocaleString("en-US")} mi limit`);
    } else {
      reasons.push(`${(limit - usage.mileage).toLocaleString("en-US")} mi of cover left`);
    }
  }

  if (part.warranty_hours != null && part.installed_hours != null && usage.engineHours != null) {
    evaluated = true;
    const limit = part.installed_hours + part.warranty_hours;
    if (usage.engineHours > limit) {
      expired = true;
      reasons.push(`Past ${limit.toLocaleString("en-US")} hr limit`);
    } else {
      reasons.push(`${(limit - usage.engineHours).toLocaleString("en-US")} hr of cover left`);
    }
  }

  if (part.warranty_type === "LIFETIME" && !expired) {
    return { state: "LIFETIME", expiresOn, reasons, summary: "Lifetime warranty" };
  }

  if (!evaluated) {
    return {
      state: "UNKNOWN",
      expiresOn,
      reasons,
      summary: "Warranty on file, no term recorded",
    };
  }

  return {
    state: expired ? "EXPIRED" : "ACTIVE",
    expiresOn,
    reasons,
    summary: expired ? "Warranty expired" : "Under warranty",
  };
}

/** "2024 Polaris RZR Pro R", preferring the nickname when one is set. */
export function vehicleTitle(vehicle: VehicleRow): string {
  if (vehicle.nickname) return vehicle.nickname;
  return vehicleDescription(vehicle);
}

export function vehicleDescription(vehicle: VehicleRow): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

/**
 * A recorded reading counts even when its meter is no longer tracked. The
 * tracking flags decide which meters the vehicle is asked about; discarding a
 * number that was already taken only strands any schedule measured in it, with
 * no way back — the reading form would refuse to collect what it already has.
 */
export function usageOf(vehicle: VehicleRow, today: string): UsageSnapshot {
  return {
    mileage: vehicle.current_mileage,
    engineHours: vehicle.current_engine_hours,
    today,
  };
}
