/**
 * Relationships between vehicles: a boat and the trailer it sits on, a truck
 * and the trailer behind it.
 *
 * The link is one level deep and optional. Keeping it shallow means no
 * recursive queries and no cycles to defend against — a trailer behind a
 * trailer is not a real case. Pure, so the rules are unit tested.
 */

import type { VehicleRow } from "./types";

/** The vehicles this one may be attached to. */
export function eligibleParents(fleet: VehicleRow[], vehicleId: string | null): VehicleRow[] {
  // Something is already attached to it, so it cannot also hang off something
  // else without making the chain two deep.
  if (vehicleId != null && fleet.some((vehicle) => vehicle.parent_vehicle_id === vehicleId)) {
    return [];
  }

  return fleet.filter(
    (vehicle) =>
      vehicle.id !== vehicleId && vehicle.parent_vehicle_id == null && vehicle.archived === 0,
  );
}

/** The vehicles attached to this one, in fleet order. */
export function childrenOf(fleet: VehicleRow[], vehicleId: string): VehicleRow[] {
  return fleet.filter((vehicle) => vehicle.parent_vehicle_id === vehicleId);
}

/**
 * The fleet ordered so each vehicle is followed by whatever is attached to it,
 * which keeps a trailer next to the boat it carries instead of somewhere else
 * in the list. Ordering only — nothing is nested or hidden.
 */
export function groupedFleet(fleet: VehicleRow[]): VehicleRow[] {
  const ordered: VehicleRow[] = [];

  for (const vehicle of fleet) {
    if (vehicle.parent_vehicle_id != null) continue;
    ordered.push(vehicle, ...childrenOf(fleet, vehicle.id));
  }

  // A child whose parent is archived out of this list still has to appear.
  for (const vehicle of fleet) {
    if (!ordered.includes(vehicle)) ordered.push(vehicle);
  }

  return ordered;
}
