import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { usageFieldsFor } from "../src/lib/due";
import type { ScheduleRow } from "../src/lib/types";

function schedule(overrides: Partial<ScheduleRow>): ScheduleRow {
  return {
    id: "sch_test",
    part_id: "part_test",
    task_type: "INSPECT",
    label: null,
    interval_miles: null,
    interval_hours: null,
    interval_months: null,
    trigger_mode: "FIRST",
    base_mileage: null,
    base_hours: null,
    base_on: null,
    is_active: 1,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("which readings a vehicle needs", () => {
  it("follows the vehicle's own meters when no schedule says otherwise", () => {
    const fields = usageFieldsFor({ tracks_mileage: 1, tracks_engine_hours: 0 }, []);

    assert.deepEqual(fields, { mileage: true, engineHours: false });
  });

  it("asks for engine hours when a schedule needs them, even with the meter untracked", () => {
    const fields = usageFieldsFor({ tracks_mileage: 1, tracks_engine_hours: 0 }, [
      schedule({ interval_hours: 50 }),
    ]);

    assert.equal(fields.engineHours, true);
  });

  it("asks for mileage when a schedule needs it, even with the meter untracked", () => {
    const fields = usageFieldsFor({ tracks_mileage: 0, tracks_engine_hours: 1 }, [
      schedule({ interval_miles: 5000 }),
    ]);

    assert.equal(fields.mileage, true);
  });

  it("ignores a paused schedule", () => {
    const fields = usageFieldsFor({ tracks_mileage: 1, tracks_engine_hours: 0 }, [
      schedule({ interval_hours: 50, is_active: 0 }),
    ]);

    assert.equal(fields.engineHours, false);
  });

  it("never hides a meter the vehicle does track", () => {
    const fields = usageFieldsFor({ tracks_mileage: 1, tracks_engine_hours: 1 }, [
      schedule({ interval_months: 12 }),
    ]);

    assert.deepEqual(fields, { mileage: true, engineHours: true });
  });

  it("offers at least one field when a calendar-only schedule is all there is", () => {
    const fields = usageFieldsFor({ tracks_mileage: 1, tracks_engine_hours: 0 }, [
      schedule({ interval_months: 6 }),
    ]);

    assert.equal(fields.mileage, true);
  });
});
