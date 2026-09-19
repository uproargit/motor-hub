import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { childrenOf, eligibleParents, groupedFleet } from "../src/lib/fleet";
import type { VehicleRow } from "../src/lib/types";

function vehicle(id: string, overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id,
    nickname: null,
    year: 2022,
    make: "Test",
    model: id,
    trim: null,
    vehicle_type: "CAR",
    vin: null,
    plate: null,
    color: null,
    purchased_on: null,
    purchase_price_cents: null,
    tracks_mileage: 1,
    tracks_engine_hours: 0,
    current_mileage: null,
    current_engine_hours: null,
    usage_updated_on: null,
    parent_vehicle_id: null,
    notes: null,
    archived: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("choosing a parent vehicle", () => {
  it("offers the other vehicles", () => {
    const fleet = [vehicle("boat"), vehicle("trailer"), vehicle("truck")];

    const ids = eligibleParents(fleet, "trailer").map((v) => v.id);

    assert.deepEqual(ids.sort(), ["boat", "truck"]);
  });

  it("never offers the vehicle itself", () => {
    const fleet = [vehicle("boat"), vehicle("trailer")];

    assert.equal(eligibleParents(fleet, "trailer").some((v) => v.id === "trailer"), false);
  });

  it("never offers a vehicle that already belongs to another", () => {
    // One level only: a trailer behind a trailer is not a case worth modelling.
    const fleet = [vehicle("boat"), vehicle("trailer", { parent_vehicle_id: "boat" }), vehicle("ski")];

    const ids = eligibleParents(fleet, "ski").map((v) => v.id);

    assert.deepEqual(ids, ["boat"]);
  });

  it("offers nothing to a vehicle that already has something attached to it", () => {
    const fleet = [vehicle("boat"), vehicle("trailer", { parent_vehicle_id: "boat" })];

    assert.deepEqual(eligibleParents(fleet, "boat"), []);
  });

  it("never offers an archived vehicle", () => {
    const fleet = [vehicle("boat", { archived: 1 }), vehicle("truck"), vehicle("trailer")];

    const ids = eligibleParents(fleet, "trailer").map((v) => v.id);

    assert.deepEqual(ids, ["truck"]);
  });

  it("offers every other vehicle when adding one that does not exist yet", () => {
    const fleet = [vehicle("boat"), vehicle("truck")];

    assert.equal(eligibleParents(fleet, null).length, 2);
  });
});

describe("finding what is attached", () => {
  it("returns the vehicles that belong to one", () => {
    const fleet = [
      vehicle("boat"),
      vehicle("trailer", { parent_vehicle_id: "boat" }),
      vehicle("ski", { parent_vehicle_id: "boat" }),
      vehicle("truck"),
    ];

    assert.deepEqual(childrenOf(fleet, "boat").map((v) => v.id), ["trailer", "ski"]);
  });

  it("returns nothing for a vehicle with nothing attached", () => {
    assert.deepEqual(childrenOf([vehicle("truck")], "truck"), []);
  });
});

describe("ordering the fleet", () => {
  it("puts what is attached directly after what it is attached to", () => {
    const fleet = [
      vehicle("boat"),
      vehicle("truck"),
      vehicle("trailer", { parent_vehicle_id: "boat" }),
    ];

    assert.deepEqual(groupedFleet(fleet).map((v) => v.id), ["boat", "trailer", "truck"]);
  });

  it("still lists a vehicle whose parent is missing from the list", () => {
    const fleet = [vehicle("trailer", { parent_vehicle_id: "sold-boat" })];

    assert.deepEqual(groupedFleet(fleet).map((v) => v.id), ["trailer"]);
  });

  it("lists every vehicle exactly once", () => {
    const fleet = [
      vehicle("boat"),
      vehicle("trailer", { parent_vehicle_id: "boat" }),
      vehicle("ski", { parent_vehicle_id: "boat" }),
      vehicle("truck"),
    ];

    assert.equal(groupedFleet(fleet).length, 4);
  });
});
