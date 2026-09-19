import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { usageOf } from "../src/lib/part-logic";
import type { VehicleRow } from "../src/lib/types";

function vehicle(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: "veh_test",
    nickname: null,
    year: 2022,
    make: "Test",
    model: "Machine",
    trim: null,
    vehicle_type: "CAR",
    vin: null,
    plate: null,
    color: null,
    purchased_on: null,
    purchase_price_cents: null,
    tracks_mileage: 1,
    tracks_engine_hours: 0,
    current_mileage: 18242,
    current_engine_hours: null,
    usage_updated_on: "2026-09-19",
    parent_vehicle_id: null,
    notes: null,
    archived: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("usage snapshot", () => {
  it("reports the readings that were recorded", () => {
    const usage = usageOf(vehicle({ tracks_engine_hours: 1, current_engine_hours: 116 }), "2026-09-19");

    assert.equal(usage.mileage, 18242);
    assert.equal(usage.engineHours, 116);
  });

  it("still reports an hours reading after the hour meter is switched off", () => {
    // Unticking the meter must not strand a schedule that counts in hours:
    // the reading exists, so the interval can still be calculated.
    const usage = usageOf(vehicle({ tracks_engine_hours: 0, current_engine_hours: 60 }), "2026-09-19");

    assert.equal(usage.engineHours, 60);
  });

  it("still reports a mileage reading after the odometer is switched off", () => {
    const usage = usageOf(vehicle({ tracks_mileage: 0, current_mileage: 4200 }), "2026-09-19");

    assert.equal(usage.mileage, 4200);
  });

  it("reports null for a reading that was never taken", () => {
    const usage = usageOf(vehicle({ tracks_engine_hours: 1, current_engine_hours: null }), "2026-09-19");

    assert.equal(usage.engineHours, null);
  });
});
