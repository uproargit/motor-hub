import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { remainingParts } from "../src/lib/format";
import type { DimensionDue, ScheduleDue } from "../src/lib/due";

function due(overrides: Partial<DimensionDue> | null, level: ScheduleDue["level"] = "OK"): ScheduleDue {
  return {
    scheduleId: "sch_test",
    level,
    urgency: 0.79,
    governing: overrides
      ? {
          dimension: "MILES",
          interval: 5000,
          base: 0,
          dueAt: 5000,
          current: 3942,
          remaining: 1058,
          progress: 0.79,
          level,
          ...overrides,
        }
      : null,
    dimensions: [],
    unevaluable: [],
  };
}

describe("splitting the remaining amount", () => {
  it("separates the figure from its unit", () => {
    assert.deepEqual(remainingParts(due({ remaining: 1058 })), {
      value: "1,058",
      unit: "miles",
      overdue: false,
    });
  });

  it("rounds engine hours to one decimal", () => {
    assert.deepEqual(remainingParts(due({ dimension: "HOURS", remaining: 6.04 })), {
      value: "6",
      unit: "hours",
      overdue: false,
    });
  });

  it("counts calendar intervals in days", () => {
    assert.deepEqual(remainingParts(due({ dimension: "CALENDAR", remaining: 273 })), {
      value: "273",
      unit: "days",
      overdue: false,
    });
  });

  it("reports an overdue amount as a positive figure", () => {
    // The hero reads "18 days overdue", so the minus sign belongs to the label,
    // not the number.
    assert.deepEqual(remainingParts(due({ dimension: "CALENDAR", remaining: -18 }, "OVERDUE")), {
      value: "18",
      unit: "days",
      overdue: true,
    });
  });

  it("uses the singular unit for one", () => {
    assert.equal(remainingParts(due({ remaining: 1 }))?.unit, "mile");
  });

  it("returns nothing when the interval cannot be calculated", () => {
    assert.equal(remainingParts(due(null, "UNKNOWN")), null);
  });
});
