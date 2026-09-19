import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { starterSchedulesFor } from "../src/lib/starter-schedules";
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

describe("starter schedules", () => {
  it("offers mileage intervals to a car", () => {
    const presets = starterSchedulesFor(vehicle());

    assert.ok(presets.length > 0);
    assert.ok(presets.some((preset) => preset.interval_miles === 5000));
  });

  it("never offers an hour interval to a vehicle with no hour meter", () => {
    const presets = starterSchedulesFor(vehicle({ tracks_engine_hours: 0 }));

    assert.equal(
      presets.filter((preset) => preset.interval_hours != null).length,
      0,
    );
  });

  it("never offers a mileage interval to a vehicle with no odometer", () => {
    const presets = starterSchedulesFor(
      vehicle({ vehicle_type: "BOAT", tracks_mileage: 0, tracks_engine_hours: 1 }),
    );

    assert.ok(presets.length > 0);
    assert.equal(
      presets.filter((preset) => preset.interval_miles != null).length,
      0,
    );
  });

  it("keeps both dimensions for a machine that tracks both", () => {
    const presets = starterSchedulesFor(
      vehicle({ vehicle_type: "UTV", tracks_mileage: 1, tracks_engine_hours: 1 }),
    );

    assert.ok(presets.some((preset) => preset.interval_hours != null));
    assert.ok(presets.some((preset) => preset.interval_miles != null));
  });

  it("drops a preset whose only interval is one the vehicle cannot measure", () => {
    // Tire rotation is mileage-only, so an hour-meter-only boat must not see it.
    const boat = starterSchedulesFor(
      vehicle({ vehicle_type: "BOAT", tracks_mileage: 0, tracks_engine_hours: 1 }),
    );

    assert.equal(boat.filter((preset) => preset.key === "tire-rotation").length, 0);
  });

  it("always leaves every offered preset with at least one interval", () => {
    for (const type of ["CAR", "UTV", "BOAT", "EQUIPMENT", "TRAILER", "OTHER"] as const) {
      const presets = starterSchedulesFor(vehicle({ vehicle_type: type, tracks_mileage: 1, tracks_engine_hours: 1 }));

      for (const preset of presets) {
        assert.ok(
          preset.interval_miles != null || preset.interval_hours != null || preset.interval_months != null,
          `${type}/${preset.key} has no interval`,
        );
      }
    }
  });

  it("gives every preset a unique key", () => {
    const presets = starterSchedulesFor(vehicle({ vehicle_type: "UTV", tracks_engine_hours: 1 }));
    const keys = presets.map((preset) => preset.key);

    assert.equal(new Set(keys).size, keys.length);
  });

  it("falls back to a calendar-only set for a vehicle type with no presets", () => {
    const presets = starterSchedulesFor(
      vehicle({ vehicle_type: "TRAILER", tracks_mileage: 1, tracks_engine_hours: 0 }),
    );

    assert.ok(presets.length > 0);
  });
});
