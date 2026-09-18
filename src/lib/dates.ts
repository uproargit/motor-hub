/**
 * Date helpers. Calendar dates are plain 'YYYY-MM-DD' strings handled in UTC so
 * that maintenance intervals never drift by a day across timezones.
 */

const DAY_MS = 86_400_000;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso).getTime() - toUtc(fromIso).getTime()) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Adds whole months, clamping to the end of the target month so that
 * 2026-01-31 + 1 month lands on 2026-02-28 rather than spilling into March.
 */
export function addMonths(iso: string, months: number): string {
  const date = toUtc(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const target = new Date(Date.UTC(year, month + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  if (!isValidIsoDate(iso)) return "—";
  return toUtc(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!isValidIsoDate(iso)) return "—";
  return toUtc(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthYear(iso: string | null | undefined): string {
  if (!isValidIsoDate(iso)) return "—";
  return toUtc(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

/** "3 months ago", "in 18 days", "today". */
export function relativeDays(days: number): string {
  const abs = Math.abs(days);
  if (abs === 0) return "today";
  const unit = abs === 1 ? "day" : "days";
  return days < 0 ? `${abs} ${unit} ago` : `in ${abs} ${unit}`;
}
