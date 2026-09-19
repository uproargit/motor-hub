import type { DueLevel } from "@/lib/due";

const TONE: Record<DueLevel, string> = {
  OVERDUE: "text-bad",
  DUE: "text-bad",
  DUE_SOON: "text-warn",
  OK: "text-accent",
  UNKNOWN: "text-faint",
};

const SIZE = 96;
const RADIUS = 40;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Three quarters of a turn, leaving the gap at the bottom like an hour meter. */
const SWEEP = CIRCUMFERENCE * 0.75;

/**
 * How much of an interval has been used, drawn as a gauge.
 *
 * The app counts toward things — 18,242 of 20,000 miles, 116 of 150 hours — so
 * the interval itself is the thing worth drawing. Past due the arc fills and
 * turns, rather than running off the end.
 */
export function Meter({
  progress,
  level,
  className = "",
}: {
  progress: number;
  level: DueLevel;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(1, progress)) * SWEEP;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={`${TONE[level]} ${className}`}
      role="presentation"
      aria-hidden
    >
      <g transform={`rotate(135 ${CENTER} ${CENTER})`} fill="none" strokeLinecap="butt">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeWidth={6}
          className="stroke-line-strong opacity-40"
          strokeDasharray={`${SWEEP} ${CIRCUMFERENCE}`}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeWidth={6}
          stroke="currentColor"
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
        />
      </g>
    </svg>
  );
}
