import Link from "next/link";
import type { ReactNode } from "react";

import { PART_STATUSES, type PartStatus } from "@/lib/domain";
import type { DueLevel } from "@/lib/due";
import { DUE_LEVEL_ICON, DUE_LEVEL_LABEL } from "@/lib/format";

export type Tone = "good" | "warn" | "bad" | "info" | "muted" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-good-soft text-good border-good/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  bad: "bg-bad-soft text-bad border-bad/30",
  info: "bg-info-soft text-info border-info/30",
  muted: "bg-raised text-muted border-line",
  accent: "bg-accent-soft text-accent border-accent/30",
};

export function Pill({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: PartStatus }) {
  const meta = PART_STATUSES[status] ?? { label: status, tone: "muted" as const };
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

const DUE_TONE: Record<DueLevel, Tone> = {
  OVERDUE: "bad",
  DUE: "bad",
  DUE_SOON: "warn",
  OK: "good",
  UNKNOWN: "muted",
};

export function DuePill({ level, label }: { level: DueLevel; label?: string }) {
  return (
    <Pill tone={DUE_TONE[level]}>
      <span aria-hidden>{DUE_LEVEL_ICON[level]}</span>
      {label ?? DUE_LEVEL_LABEL[level]}
    </Pill>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "muted",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1.5 text-2xl font-bold tabular-nums ${
          tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );

  const className = "card block px-4 py-3.5 transition";
  return href ? (
    <Link href={href} className={`${className} hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "📦",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Label/value pairs used throughout the part detail view. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  const shown = items.filter((item) => item.value != null && item.value !== "");
  if (shown.length === 0) return null;

  return (
    <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {shown.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm text-accent">{eyebrow}</div> : null}
        <h1 className="display text-2xl text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
