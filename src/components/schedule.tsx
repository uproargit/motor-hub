import Link from "next/link";

import { TASK_TYPES, type TaskType } from "@/lib/domain";
import type { DimensionDue, ScheduleDue } from "@/lib/due";
import {
  describeInterval,
  describeNextDue,
  describeRemaining,
  formatDimensionAmount,
  formatDimensionValue,
} from "@/lib/format";
import type { ScheduleRow } from "@/lib/types";

import { DuePill, Pill } from "./ui";

export function taskLabel(schedule: ScheduleRow): string {
  return schedule.label ?? TASK_TYPES[schedule.task_type as TaskType]?.label ?? "Service";
}

const DIMENSION_LABEL: Record<DimensionDue["dimension"], string> = {
  MILES: "Mileage",
  HOURS: "Engine hours",
  CALENDAR: "Calendar",
};

/** Bar showing how much of the current interval has been used up. */
function ProgressBar({ progress, level }: { progress: number; level: ScheduleDue["level"] }) {
  const pct = Math.max(0, Math.min(100, progress * 100));
  const color =
    level === "OVERDUE" || level === "DUE" ? "bg-bad" : level === "DUE_SOON" ? "bg-warn" : "bg-good";

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="presentation">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * One maintenance schedule with its calculated next-due point, e.g.
 * "Inspect · Every 50 hours · Next at 122 hr · 6 hours remaining".
 */
export function ScheduleCard({
  schedule,
  due,
  actions,
  readingHref,
}: {
  schedule: ScheduleRow;
  due: ScheduleDue;
  actions?: React.ReactNode;
  /** Where to go to record the reading this schedule is waiting on. */
  readingHref?: string;
}) {
  const inactive = schedule.is_active === 0;

  return (
    <div className={`rounded-lg border border-line bg-raised p-4 ${inactive ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-ink">{taskLabel(schedule)}</h4>
            {inactive ? <Pill tone="muted">Paused</Pill> : <DuePill level={due.level} />}
          </div>
          <p className="mt-0.5 text-sm text-muted">{describeInterval(schedule)}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>

      {due.governing ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ink">
              <span className="text-muted">Next {TASK_TYPES[schedule.task_type as TaskType].verb.toLowerCase()}: </span>
              <span className="font-semibold">{describeNextDue(due)}</span>
            </p>
            <p
              className={`text-sm font-semibold ${
                due.level === "OVERDUE" || due.level === "DUE"
                  ? "text-bad"
                  : due.level === "DUE_SOON"
                    ? "text-warn"
                    : "text-muted"
              }`}
            >
              {describeRemaining(due)}
            </p>
          </div>
          <ProgressBar progress={due.governing.progress} level={due.level} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          {describeRemaining(due)}
          {due.unevaluable.length > 0
            ? ` (needs a current ${due.unevaluable.map((d) => DIMENSION_LABEL[d].toLowerCase()).join(" / ")} reading)`
            : ""}
          {due.unevaluable.length > 0 && readingHref ? (
            <>
              {" "}
              <Link href={readingHref} className="font-medium text-accent underline">
                Record one
              </Link>
            </>
          ) : null}
        </p>
      )}

      {due.dimensions.length > 1 ? (
        <ul className="mt-3 grid gap-1.5 border-t border-line pt-3 text-xs text-muted sm:grid-cols-2">
          {due.dimensions.map((dimension) => (
            <li key={dimension.dimension} className="flex items-baseline justify-between gap-2">
              <span>{DIMENSION_LABEL[dimension.dimension]}</span>
              <span className="tabular-nums text-ink">
                {formatDimensionValue(dimension.dimension, dimension.dueAt)}
                <span className="text-muted">
                  {" · "}
                  {dimension.remaining < 0 ? "-" : ""}
                  {formatDimensionAmount(dimension.dimension, dimension.remaining)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {schedule.notes ? <p className="mt-3 text-sm text-muted">{schedule.notes}</p> : null}
    </div>
  );
}
