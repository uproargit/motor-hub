import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addMonths, daysBetween } from "../src/lib/dates";
import { compareDue, evaluateSchedule } from "../src/lib/due";
import { describeNextDue, describeRemaining } from "../src/lib/format";
import type { ScheduleRow, UsageSnapshot } from "../src/lib/types";

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

function usage(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return { mileage: null, engineHours: null, today: "2026-09-18", ...overrides };
}

describe("engine-hour intervals", () => {
  it("calculates remaining hours for the Method wheels example", () => {
    // Installed at 42 engine hours, inspect every 100 hours, now at 84 hours.
    const due = evaluateSchedule(
      schedule({ base_hours: 42, interval_hours: 100 }),
      usage({ engineHours: 84 }),
    );

    assert.equal(due.governing?.dueAt, 142);
    assert.equal(due.governing?.remaining, 58);
    assert.equal(due.level, "OK");
    assert.equal(describeRemaining(due), "58 hours remaining");
  });

  it("calculates the UTV drive belt example and flags it due soon", () => {
    // Installed at 72 hours, inspect every 50 hours -> next inspection 122 hours.
    const belt = schedule({ base_hours: 72, interval_hours: 50 });

    const fresh = evaluateSchedule(belt, usage({ engineHours: 72 }));
    assert.equal(fresh.governing?.dueAt, 122);
    assert.equal(fresh.level, "OK");

    // Six hours out, the dashboard should be warning about it.
    const approaching = evaluateSchedule(belt, usage({ engineHours: 116 }));
    assert.equal(approaching.level, "DUE_SOON");
    assert.equal(describeRemaining(approaching), "6 hours remaining");

    const past = evaluateSchedule(belt, usage({ engineHours: 130 }));
    assert.equal(past.level, "OVERDUE");
    assert.equal(describeRemaining(past), "Overdue by 8 hours");
  });
});

describe("mileage intervals", () => {
  it("calculates the K&N air filter example", () => {
    // Installed at 2,400 miles, clean every 5,000 miles -> next service 7,400.
    const due = evaluateSchedule(
      schedule({ task_type: "CLEAN", base_mileage: 2400, interval_miles: 5000 }),
      usage({ mileage: 3100 }),
    );

    assert.equal(due.governing?.dueAt, 7400);
    assert.equal(due.governing?.remaining, 4300);
    assert.equal(due.level, "OK");
    assert.equal(describeNextDue(due), "7,400 mi");
  });

  it("uses a 500 mile floor so short intervals still warn", () => {
    const due = evaluateSchedule(
      schedule({ base_mileage: 0, interval_miles: 1000 }),
      usage({ mileage: 600 }),
    );
    assert.equal(due.level, "DUE_SOON"); // 400 remaining, inside the 500 mile floor
  });
});

describe("calendar intervals", () => {
  it("calculates the boat impeller example", () => {
    // Installed June 2026, replace every 12 months -> next replacement June 2027.
    const due = evaluateSchedule(
      schedule({ task_type: "REPLACE", base_on: "2026-06-10", interval_months: 12 }),
      usage(),
    );

    assert.equal(due.governing?.dueAt, "2027-06-10");
    assert.equal(due.level, "OK");
    assert.equal(describeNextDue(due), "June 2027");
  });

  it("reports calendar overdue in days", () => {
    // Base 2025-08-31 + 12 months = 2026-08-31, evaluated on 2026-09-18.
    const due = evaluateSchedule(
      schedule({ base_on: "2025-08-31", interval_months: 12 }),
      usage(),
    );

    assert.equal(due.level, "OVERDUE");
    assert.equal(due.governing?.remaining, -18);
    assert.equal(describeRemaining(due), "Overdue by 18 days");
  });

  it("clamps month arithmetic to the end of a short month", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(addMonths("2026-12-15", 12), "2027-12-15");
    assert.equal(daysBetween("2026-09-18", "2026-09-18"), 0);
  });
});

describe("combined triggers", () => {
  const combined = schedule({
    base_mileage: 10_000,
    interval_miles: 10_000,
    base_on: "2026-03-01",
    interval_months: 6,
  });

  it("FIRST mode is driven by whichever interval arrives first", () => {
    // Calendar is 100% consumed on 2026-09-01; mileage is only 10% consumed.
    const due = evaluateSchedule(combined, usage({ mileage: 11_000, today: "2026-09-18" }));
    assert.equal(due.governing?.dimension, "CALENDAR");
    assert.equal(due.level, "OVERDUE");
    assert.equal(due.dimensions.length, 2);
  });

  it("LAST mode waits for every interval to elapse", () => {
    const due = evaluateSchedule(
      { ...combined, trigger_mode: "LAST" },
      usage({ mileage: 11_000, today: "2026-09-18" }),
    );
    assert.equal(due.governing?.dimension, "MILES");
    assert.equal(due.level, "OK");
  });
});

describe("missing readings", () => {
  it("reports a schedule as unknown when the vehicle has no current reading", () => {
    const due = evaluateSchedule(schedule({ base_hours: 10, interval_hours: 50 }), usage());
    assert.equal(due.level, "UNKNOWN");
    assert.equal(due.governing, null);
    assert.deepEqual(due.unevaluable, ["HOURS"]);
    assert.equal(describeRemaining(due), "Add a current reading to calculate");
  });

  it("still evaluates the dimensions it can", () => {
    const due = evaluateSchedule(
      schedule({ base_hours: 10, interval_hours: 50, base_on: "2026-01-01", interval_months: 12 }),
      usage(),
    );
    assert.equal(due.level, "OK");
    assert.equal(due.governing?.dimension, "CALENDAR");
    assert.deepEqual(due.unevaluable, ["HOURS"]);
  });
});

describe("ordering", () => {
  it("sorts overdue first, then by how far through the interval each item is", () => {
    const overdue = evaluateSchedule(schedule({ id: "a", base_hours: 0, interval_hours: 50 }), usage({ engineHours: 60 }));
    const soon = evaluateSchedule(schedule({ id: "b", base_hours: 0, interval_hours: 50 }), usage({ engineHours: 45 }));
    const ok = evaluateSchedule(schedule({ id: "c", base_hours: 0, interval_hours: 50 }), usage({ engineHours: 5 }));
    const unknown = evaluateSchedule(schedule({ id: "d", base_mileage: 0, interval_miles: 100 }), usage());

    const sorted = [ok, unknown, overdue, soon].sort(compareDue).map((d) => d.scheduleId);
    assert.deepEqual(sorted, ["a", "b", "c", "d"]);
  });
});
