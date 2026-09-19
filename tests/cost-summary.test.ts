import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { costSummaryFrom, partCountsFrom } from "../src/lib/part-logic";

describe("cost summary arithmetic", () => {
  it("totals modifications, maintenance and service labour", () => {
    const summary = costSummaryFrom(
      { modification_cents: 400000, maintenance_cents: 25000, parts_cents: 380000, labor_cents: 45000 },
      12000,
    );

    assert.equal(summary.totalCents, 437000);
  });

  it("carries each figure through untouched", () => {
    const summary = costSummaryFrom(
      { modification_cents: 400000, maintenance_cents: 25000, parts_cents: 380000, labor_cents: 45000 },
      12000,
    );

    assert.deepEqual(summary, {
      modificationCents: 400000,
      maintenanceCents: 25000,
      partsCents: 380000,
      laborCents: 45000,
      serviceCents: 12000,
      totalCents: 437000,
    });
  });

  it("reads a vehicle with no parts as zero, not null", () => {
    // SUM() over no rows is NULL in SQLite, and a null would render as "—"
    // where the honest answer is $0.
    const summary = costSummaryFrom(null, null);

    assert.deepEqual(summary, {
      modificationCents: 0,
      maintenanceCents: 0,
      partsCents: 0,
      laborCents: 0,
      serviceCents: 0,
      totalCents: 0,
    });
  });

  it("treats a missing column as zero", () => {
    const summary = costSummaryFrom(
      { modification_cents: null, maintenance_cents: 5000, parts_cents: null, labor_cents: null },
      null,
    );

    assert.equal(summary.modificationCents, 0);
    assert.equal(summary.totalCents, 5000);
  });
});

describe("part counts", () => {
  it("reads the three counts", () => {
    const counts = partCountsFrom({ total: 12, installed: 9, modifications: 4 });

    assert.deepEqual(counts, { total: 12, installed: 9, modifications: 4 });
  });

  it("reads a vehicle with no parts as zeros", () => {
    assert.deepEqual(partCountsFrom(null), { total: 0, installed: 0, modifications: 0 });
  });
});
