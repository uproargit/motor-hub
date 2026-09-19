import Link from "next/link";

import { Meter } from "@/components/meter";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { TASK_TYPES } from "@/lib/domain";
import { groupedFleet } from "@/lib/fleet";
import {
  DUE_LEVEL_LABEL,
  describeInterval,
  describeNextDue,
  describeRemaining,
  formatDimensionValue,
  formatHours,
  formatMiles,
  formatMoney,
  pluralize,
  remainingParts,
} from "@/lib/format";
import { totalInstalledCents, vehicleTitle } from "@/lib/part-logic";
import { attentionItems, fleetStats, listVehicles, recentlyInstalled, type AttentionItem } from "@/lib/queries";
import type { VehicleRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const DUE_TEXT: Record<string, string> = {
  OVERDUE: "text-bad",
  DUE: "text-bad",
  DUE_SOON: "text-warn",
  OK: "text-muted",
  UNKNOWN: "text-faint",
};

export default async function DashboardPage() {
  const fleet = await listVehicles();

  const [stats, needsAttention, upcomingAll, recent] = await Promise.all([
    fleetStats(),
    attentionItems({ fleet, levels: ["OVERDUE", "DUE", "DUE_SOON"] }),
    attentionItems({ fleet, levels: ["OK"] }),
    recentlyInstalled(6),
  ]);

  if (fleet.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Motor Hub" description="Build sheets, parts history and maintenance for everything you own." />
        <div className="border border-line bg-surface">
          <EmptyState
            icon="🔧"
            title="Start with a vehicle"
            description="Add a car, truck, UTV, boat or anything else with an engine, then record the parts on it."
            action={
              <Link href="/vehicles/new" className="btn-primary">
                Add your first vehicle
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const nearest = needsAttention[0] ?? upcomingAll[0] ?? null;
  const rest = needsAttention.filter((item) => item !== nearest);
  const upcoming = upcomingAll.filter((item) => item !== nearest).slice(0, 5);

  return (
    <div className="space-y-10">
      {nearest ? <NextDue item={nearest} /> : null}

      <Fleet fleet={fleet} attention={needsAttention} />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Ledger
          heading={rest.length > 0 ? "Also due" : "Nothing else due"}
          count={rest.length ? `${pluralize(rest.length, "item")}` : undefined}
          href="/maintenance"
          hrefLabel="All schedules"
        >
          {rest.slice(0, 6).map((item) => (
            <DueRow key={item.schedule.id} item={item} />
          ))}
          {rest.length === 0 ? (
            <p className="py-3 text-sm text-muted">Every scheduled part across the fleet is inside its interval.</p>
          ) : null}
        </Ledger>

        <Ledger heading="Coming up" count={upcoming.length ? `${pluralize(upcoming.length, "item")}` : undefined}>
          {upcoming.map((item) => (
            <DueRow key={item.schedule.id} item={item} />
          ))}
          {upcoming.length === 0 ? (
            <p className="py-3 text-sm text-muted">Add an interval to a part and it is tracked here.</p>
          ) : null}
        </Ledger>

        <Ledger heading="Recently fitted" href="/vehicles" hrefLabel="All vehicles">
          {recent.map(({ part, vehicle }) => {
            const cost = totalInstalledCents(part);
            return (
              <Link
                key={part.id}
                href={`/vehicles/${vehicle.id}/parts/${part.id}`}
                className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 transition hover:bg-raised"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{part.name}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {vehicleTitle(vehicle)}, {formatDate(part.installed_on)}
                  </span>
                </span>
                {cost != null ? (
                  <span className="shrink-0 tabular-nums text-sm text-ink">{formatMoney(cost)}</span>
                ) : null}
              </Link>
            );
          })}
          {recent.length === 0 ? <p className="py-3 text-sm text-muted">No parts recorded yet.</p> : null}
        </Ledger>

        <Ledger heading="Spend">
          <Figure label="Modifications" value={formatMoney(stats.modificationCents)} />
          <Figure label="Everything, including maintenance and labour" value={formatMoney(stats.totalSpendCents)} />
          <Figure label="Parts fitted" value={String(stats.installedParts)} note={`${stats.totalParts} records kept`} />
        </Ledger>
      </div>
    </div>
  );
}

/**
 * The hero: the single nearest thing to falling due, with the amount left set
 * large. One number, because that is the question the app exists to answer.
 */
function NextDue({ item }: { item: AttentionItem }) {
  const { vehicle, part, schedule, due } = item;
  const remaining = remainingParts(due);
  const task = TASK_TYPES[schedule.task_type];

  return (
    <section className="border-y-2 border-ink">
      <Link
        href={`/vehicles/${vehicle.id}/parts/${part.id}`}
        className="grid gap-x-8 gap-y-5 py-7 transition hover:bg-raised sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
      >
        <Meter
          progress={due.governing?.progress ?? 0}
          level={due.level}
          className="size-20 shrink-0 sm:size-24"
        />

        <div className="min-w-0">
          {remaining ? (
            <p className="flex items-baseline gap-2.5">
              <span
                className={`readout text-6xl leading-none sm:text-7xl ${
                  DUE_TEXT[due.level]
                }`}
              >
                {remaining.value}
              </span>
              <span className="text-lg text-muted">
                {remaining.unit} {remaining.overdue ? "overdue" : `to ${task.verb.toLowerCase()}`}
              </span>
            </p>
          ) : (
            <p className="text-3xl font-semibold text-ink">{DUE_LEVEL_LABEL[due.level]}</p>
          )}

          <p className="mt-3 text-lg font-medium text-ink">{part.name}</p>
          <p className="text-sm text-muted">
            {vehicleTitle(vehicle)}, now at{" "}
            {vehicle.tracks_engine_hours
              ? formatHours(vehicle.current_engine_hours)
              : formatMiles(vehicle.current_mileage)}
          </p>
        </div>

        <dl className="space-y-1 text-sm sm:min-w-56">
          <Term label="Task" value={task.label} />
          <Term label="Every" value={describeInterval(schedule)} />
          <Term label="Due at" value={describeNextDue(due)} />
          <Term
            label="Last done"
            value={
              due.governing?.dimension === "CALENDAR"
                ? formatDate(String(due.governing.base))
                : formatDimensionValue(due.governing?.dimension ?? "MILES", due.governing?.base ?? 0)
            }
          />
        </dl>
      </Link>
    </section>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line pb-1">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** Every machine as a row, with anything attached to it sitting underneath. */
function Fleet({ fleet, attention }: { fleet: VehicleRow[]; attention: AttentionItem[] }) {
  const dueCount = (vehicleId: string) => attention.filter((item) => item.vehicle.id === vehicleId).length;

  return (
    <section>
      <Heading text="Fleet" href="/vehicles" hrefLabel="Manage" />
      <ul>
        {groupedFleet(fleet).map((vehicle) => {
          const attached = vehicle.parent_vehicle_id != null;
          const due = dueCount(vehicle.id);

          return (
            <li key={vehicle.id}>
              <Link
                href={`/vehicles/${vehicle.id}`}
                className="grid gap-x-6 gap-y-0.5 border-b border-line py-3 transition hover:bg-raised sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline"
              >
                <span className={`min-w-0 font-medium text-ink ${attached ? "pl-5 text-muted" : ""}`}>
                  {attached ? <span className="mr-2 text-faint">└</span> : null}
                  {vehicleTitle(vehicle)}
                </span>

                <span className="flex items-baseline justify-between gap-6 text-sm tabular-nums sm:justify-end">
                  <span className="text-muted">
                    {vehicle.tracks_mileage ? formatMiles(vehicle.current_mileage) : null}
                    {vehicle.tracks_mileage && vehicle.tracks_engine_hours ? "  ·  " : null}
                    {vehicle.tracks_engine_hours ? formatHours(vehicle.current_engine_hours) : null}
                  </span>
                  <span className={`w-20 text-right ${due ? "text-bad" : "text-muted"}`}>
                    {due ? `${due} due` : "on schedule"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Ledger({
  heading,
  count,
  href,
  hrefLabel,
  children,
}: {
  heading: string;
  count?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Heading text={heading} count={count} href={href} hrefLabel={hrefLabel} />
      <div>{children}</div>
    </section>
  );
}

function Heading({
  text,
  count,
  href,
  hrefLabel,
}: {
  text: string;
  count?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-4 border-b-2 border-ink pb-1.5">
      <h2 className="display text-lg text-ink">
        {text}
        {count ? <span className="ml-2 text-sm font-normal text-muted">{count}</span> : null}
      </h2>
      {href ? (
        <Link href={href} className="text-sm text-accent underline-offset-4 hover:underline">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function DueRow({ item }: { item: AttentionItem }) {
  const { vehicle, part, schedule, due } = item;

  return (
    <Link
      href={`/vehicles/${vehicle.id}/parts/${part.id}`}
      className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 transition hover:bg-raised"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{part.name}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {vehicleTitle(vehicle)}, {TASK_TYPES[schedule.task_type].label.toLowerCase()}
        </span>
      </span>
      <span className={`shrink-0 text-right text-sm tabular-nums ${DUE_TEXT[due.level]}`}>
        {describeRemaining(due)}
      </span>
    </Link>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="shrink-0 text-right">
        <span className="readout text-lg text-ink">{value}</span>
        {note ? <span className="ml-2 text-sm text-muted">{note}</span> : null}
      </span>
    </div>
  );
}
