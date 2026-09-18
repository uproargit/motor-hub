/**
 * Maintenance due engine.
 *
 * A schedule counts from a base point (the install readings, advanced every
 * time the task is actually performed) and may trigger on any combination of
 * mileage, engine hours and calendar time:
 *
 *   Method wheels    installed at 42 hours, inspect every 100 hours
 *                    -> due at 142 hours, 58 hours remaining
 *   K&N air filter   installed at 2,400 miles, clean every 5,000 miles
 *                    -> due at 7,400 miles
 *   Boat impeller    installed June 2026, replace every 12 months
 *                    -> due June 2027
 *
 * This module is pure so the arithmetic can be tested without a database.
 */

import { addMonths, daysBetween, isValidIsoDate } from "./dates";
import type { ScheduleRow, UsageSnapshot } from "./types";

export type DueLevel = "OVERDUE" | "DUE" | "DUE_SOON" | "OK" | "UNKNOWN";

export type Dimension = "MILES" | "HOURS" | "CALENDAR";

/** Severity ordering used when sorting a mixed list of due items. */
export const DUE_LEVEL_RANK: Record<DueLevel, number> = {
  OVERDUE: 0,
  DUE: 1,
  DUE_SOON: 2,
  OK: 3,
  UNKNOWN: 4,
};

/**
 * A task counts as "coming up" inside the last 20% of its interval, with a
 * floor so that short intervals still give useful warning.
 */
const SOON_FRACTION = 0.2;
const SOON_FLOOR: Record<Dimension, number> = {
  MILES: 500,
  HOURS: 10,
  CALENDAR: 30, // days
};

export interface DimensionDue {
  dimension: Dimension;
  /** Interval length in miles, hours or months. */
  interval: number;
  /** Reading (or date) the current interval counts from. */
  base: number | string;
  /** Absolute point the task falls due: mileage, engine hours or ISO date. */
  dueAt: number | string;
  /** Current reading for this dimension: mileage, hours or ISO date. */
  current: number | string;
  /** Miles, hours or days left. Negative means past due. */
  remaining: number;
  /** Fraction of the interval consumed. 1.0 means exactly due. */
  progress: number;
  level: DueLevel;
}

export interface ScheduleDue {
  scheduleId: string;
  level: DueLevel;
  /**
   * Fraction of the governing interval consumed. Above 1 means overdue, and it
   * is the sort key used to rank attention items against each other.
   */
  urgency: number;
  /** The dimension that determines the level, if any is evaluable. */
  governing: DimensionDue | null;
  /** Every configured dimension that could be evaluated. */
  dimensions: DimensionDue[];
  /** Dimensions configured but not evaluable, e.g. no current odometer reading. */
  unevaluable: Dimension[];
}

function levelFor(remaining: number, interval: number, dimension: Dimension): DueLevel {
  if (remaining < 0) return "OVERDUE";
  if (remaining === 0) return "DUE";
  const soonWindow = Math.min(interval, Math.max(interval * SOON_FRACTION, SOON_FLOOR[dimension]));
  return remaining <= soonWindow ? "DUE_SOON" : "OK";
}

function evaluateNumeric(
  dimension: Extract<Dimension, "MILES" | "HOURS">,
  interval: number,
  base: number,
  current: number,
): DimensionDue {
  const dueAt = base + interval;
  const remaining = dueAt - current;
  return {
    dimension,
    interval,
    base,
    dueAt,
    current,
    remaining,
    progress: (current - base) / interval,
    level: levelFor(remaining, interval, dimension),
  };
}

function evaluateCalendar(intervalMonths: number, baseOn: string, today: string): DimensionDue {
  const dueOn = addMonths(baseOn, intervalMonths);
  const remaining = daysBetween(today, dueOn);
  const intervalDays = daysBetween(baseOn, dueOn);
  const elapsed = daysBetween(baseOn, today);
  return {
    dimension: "CALENDAR",
    interval: intervalMonths,
    base: baseOn,
    dueAt: dueOn,
    current: today,
    remaining,
    progress: intervalDays > 0 ? elapsed / intervalDays : 1,
    // Calendar thresholds are expressed in days, so pass the interval in days.
    level: levelFor(remaining, intervalDays, "CALENDAR"),
  };
}

/**
 * Evaluates one schedule against the vehicle's current usage.
 *
 * With `trigger_mode = 'FIRST'` (the default) the task is due as soon as any
 * configured interval elapses, so the most urgent dimension governs. With
 * `'LAST'` every interval must elapse, so the least urgent one governs.
 */
export function evaluateSchedule(schedule: ScheduleRow, usage: UsageSnapshot): ScheduleDue {
  const dimensions: DimensionDue[] = [];
  const unevaluable: Dimension[] = [];

  if (schedule.interval_miles && schedule.interval_miles > 0) {
    if (schedule.base_mileage != null && usage.mileage != null) {
      dimensions.push(evaluateNumeric("MILES", schedule.interval_miles, schedule.base_mileage, usage.mileage));
    } else {
      unevaluable.push("MILES");
    }
  }

  if (schedule.interval_hours && schedule.interval_hours > 0) {
    if (schedule.base_hours != null && usage.engineHours != null) {
      dimensions.push(evaluateNumeric("HOURS", schedule.interval_hours, schedule.base_hours, usage.engineHours));
    } else {
      unevaluable.push("HOURS");
    }
  }

  if (schedule.interval_months && schedule.interval_months > 0) {
    if (isValidIsoDate(schedule.base_on)) {
      dimensions.push(evaluateCalendar(schedule.interval_months, schedule.base_on, usage.today));
    } else {
      unevaluable.push("CALENDAR");
    }
  }

  if (dimensions.length === 0) {
    return {
      scheduleId: schedule.id,
      level: "UNKNOWN",
      urgency: -1,
      governing: null,
      dimensions: [],
      unevaluable,
    };
  }

  const byUrgency = [...dimensions].sort((a, b) => b.progress - a.progress);
  const governing = schedule.trigger_mode === "LAST" ? byUrgency[byUrgency.length - 1] : byUrgency[0];

  return {
    scheduleId: schedule.id,
    level: governing.level,
    urgency: governing.progress,
    governing,
    dimensions,
    unevaluable,
  };
}

/** Sorts most urgent first: overdue before due-soon, then by interval consumed. */
export function compareDue(a: ScheduleDue, b: ScheduleDue): number {
  const rank = DUE_LEVEL_RANK[a.level] - DUE_LEVEL_RANK[b.level];
  return rank !== 0 ? rank : b.urgency - a.urgency;
}
