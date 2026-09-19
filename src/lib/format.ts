import { formatDate, formatMonthYear } from "./dates";
import type { DimensionDue, DueLevel, ScheduleDue } from "./due";

/* ---------------------------------------------------------------- money --- */

/** Parses free-form currency input ("$1,299.00", "1299") into integer cents. */
export function parseMoneyToCents(input: FormDataEntryValue | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function formatMoney(cents: number | null | undefined, fallback = "—"): string {
  if (cents == null) return fallback;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Editable value for a money form field, e.g. 128900 -> "1289.00". */
export function moneyInputValue(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

/* --------------------------------------------------------------- numbers -- */

export function parseIntOrNull(input: FormDataEntryValue | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function parseFloatOrNull(input: FormDataEntryValue | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function formatMiles(miles: number | null | undefined, fallback = "—"): string {
  if (miles == null) return fallback;
  return `${Math.round(miles).toLocaleString("en-US")} mi`;
}

export function formatHours(hours: number | null | undefined, fallback = "—"): string {
  if (hours == null) return fallback;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString("en-US")} hr`;
}

/** Formats a reading in the units of the dimension it belongs to. */
export function formatDimensionValue(dimension: DimensionDue["dimension"], value: number | string): string {
  if (dimension === "CALENDAR") return formatDate(String(value));
  return dimension === "MILES" ? formatMiles(Number(value)) : formatHours(Number(value));
}

/** "58 hours", "1,200 miles", "18 days" — a bare magnitude with its unit. */
export function formatDimensionAmount(dimension: DimensionDue["dimension"], amount: number): string {
  const abs = Math.abs(amount);
  if (dimension === "CALENDAR") return `${abs.toLocaleString("en-US")} ${abs === 1 ? "day" : "days"}`;
  if (dimension === "MILES") return `${Math.round(abs).toLocaleString("en-US")} ${abs === 1 ? "mile" : "miles"}`;
  const rounded = Math.round(abs * 10) / 10;
  return `${rounded.toLocaleString("en-US")} ${rounded === 1 ? "hour" : "hours"}`;
}

/* ------------------------------------------------------------ due status -- */

export const DUE_LEVEL_LABEL: Record<DueLevel, string> = {
  OVERDUE: "Overdue",
  DUE: "Due now",
  DUE_SOON: "Due soon",
  OK: "On schedule",
  UNKNOWN: "Not calculable",
};

export const DUE_LEVEL_ICON: Record<DueLevel, string> = {
  OVERDUE: "🔴",
  DUE: "🟠",
  DUE_SOON: "⚠️",
  OK: "🟢",
  UNKNOWN: "⚪",
};

/**
 * The remaining amount split into its figure and its unit, for places that set
 * the number large and the unit small. Overdue comes back as a positive figure
 * with a flag, because the minus sign belongs to the wording around it.
 */
export function remainingParts(
  due: ScheduleDue,
): { value: string; unit: string; overdue: boolean } | null {
  const governing = due.governing;
  if (!governing) return null;

  const [value, ...unit] = formatDimensionAmount(governing.dimension, governing.remaining).split(" ");

  return { value, unit: unit.join(" "), overdue: governing.remaining < 0 };
}

/** "58 hours remaining", "overdue by 18 days", "due now". */
export function describeRemaining(due: ScheduleDue): string {
  const governing = due.governing;
  if (!governing) return "Add a current reading to calculate";
  if (governing.remaining < 0) {
    return `Overdue by ${formatDimensionAmount(governing.dimension, governing.remaining)}`;
  }
  if (governing.remaining === 0) return "Due now";
  return `${formatDimensionAmount(governing.dimension, governing.remaining)} remaining`;
}

/** "Next inspection: 122 hours", "Next service: June 2027". */
export function describeNextDue(due: ScheduleDue): string {
  const governing = due.governing;
  if (!governing) return "—";
  if (governing.dimension === "CALENDAR") return formatMonthYear(String(governing.dueAt));
  return formatDimensionValue(governing.dimension, governing.dueAt);
}

/* ----------------------------------------------------------------- misc --- */

export function textOrNull(input: FormDataEntryValue | null | undefined): string | null {
  if (input == null) return null;
  const value = String(input).trim();
  return value === "" ? null : value;
}

export function checkboxToInt(input: FormDataEntryValue | null | undefined): number {
  return input === "on" || input === "true" || input === "1" ? 1 : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/* ------------------------------------------------------------ schedules --- */

/** "Every 5,000 miles", "Every 50 hours or 6 months, whichever comes first". */
export function describeInterval(schedule: {
  interval_miles: number | null;
  interval_hours: number | null;
  interval_months: number | null;
  trigger_mode: string;
}): string {
  const parts: string[] = [];
  if (schedule.interval_miles) parts.push(`${schedule.interval_miles.toLocaleString("en-US")} miles`);
  if (schedule.interval_hours) parts.push(`${schedule.interval_hours.toLocaleString("en-US")} hours`);
  if (schedule.interval_months) {
    parts.push(schedule.interval_months === 12 ? "12 months" : `${schedule.interval_months} months`);
  }

  if (parts.length === 0) return "No interval set";
  if (parts.length === 1) return `Every ${parts[0]}`;

  const joined = `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
  const qualifier = schedule.trigger_mode === "LAST" ? "whichever comes last" : "whichever comes first";
  return `Every ${joined}, ${qualifier}`;
}
