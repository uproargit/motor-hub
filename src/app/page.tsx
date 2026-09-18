import Link from "next/link";

import { Card, CardHeader, EmptyState, PageHeader, Pill, Stat } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { TASK_TYPES, VEHICLE_TYPES } from "@/lib/domain";
import {
  describeNextDue,
  describeRemaining,
  DUE_LEVEL_ICON,
  formatHours,
  formatMiles,
  formatMoney,
  pluralize,
} from "@/lib/format";
import { totalInstalledCents, vehicleTitle } from "@/lib/part-logic";
import { attentionItems, fleetStats, listVehicles, recentlyInstalled, type AttentionItem } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [vehicles, stats, needsAttention, upcomingAll, recent] = await Promise.all([
    listVehicles(),
    fleetStats(),
    attentionItems({ levels: ["OVERDUE", "DUE", "DUE_SOON"] }),
    attentionItems({ levels: ["OK"] }),
    recentlyInstalled(6),
  ]);
  const upcoming = upcomingAll.slice(0, 6);

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Motor Hub" description="Build sheets, parts history and maintenance for everything you own." />
        <Card>
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
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${pluralize(stats.vehicles, "vehicle")} · ${pluralize(stats.totalParts, "part record")}`}
        actions={
          <Link href="/vehicles/new" className="btn-secondary">
            Add vehicle
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Parts needing attention"
          value={stats.overdue + stats.dueSoon}
          tone={stats.overdue ? "bad" : stats.dueSoon ? "warn" : "muted"}
          hint={
            stats.overdue
              ? `${stats.overdue} overdue · ${stats.dueSoon} due soon`
              : stats.dueSoon
                ? `${stats.dueSoon} coming up`
                : "Everything on schedule"
          }
          href="/maintenance"
        />
        <Stat
          label="Total modification cost"
          value={formatMoney(stats.modificationCents)}
          hint={`${formatMoney(stats.totalSpendCents)} including maintenance`}
        />
        <Stat label="Parts installed" value={stats.installedParts} hint={`${stats.totalParts} records in total`} />
        <Stat label="Vehicles" value={stats.vehicles} href="/vehicles" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Parts needing attention"
              subtitle={needsAttention.length ? "Overdue first, then what is coming up." : undefined}
              action={
                <Link href="/maintenance" className="btn-ghost">
                  View all
                </Link>
              }
            />
            {needsAttention.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Nothing needs attention"
                description="Every scheduled part across the fleet is inside its interval."
              />
            ) : (
              <ul className="divide-y divide-line">
                {needsAttention.slice(0, 8).map((item) => (
                  <li key={item.schedule.id}>
                    <AttentionRow item={item} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Upcoming part maintenance" subtitle="Scheduled work that is still comfortably ahead." />
            {upcoming.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="No upcoming schedules"
                description="Add an interval to a part and it will be tracked here."
              />
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((item) => (
                  <li key={item.schedule.id}>
                    <AttentionRow item={item} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recently installed" />
            {recent.length === 0 ? (
              <EmptyState icon="🔩" title="No parts recorded yet" />
            ) : (
              <ul className="divide-y divide-line">
                {recent.map(({ part, vehicle }) => {
                  const cost = totalInstalledCents(part);
                  return (
                    <li key={part.id}>
                      <Link
                        href={`/vehicles/${vehicle.id}/parts/${part.id}`}
                        className="flex items-start justify-between gap-3 px-5 py-3 transition hover:bg-raised"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{part.name}</p>
                          <p className="mt-0.5 truncate text-sm text-muted">
                            {vehicleTitle(vehicle)} · {formatDate(part.installed_on)}
                          </p>
                        </div>
                        {cost != null ? (
                          <span className="shrink-0 tabular-nums text-sm font-semibold text-ink">
                            {formatMoney(cost)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Fleet" action={<Link href="/vehicles" className="btn-ghost">All</Link>} />
            <ul className="divide-y divide-line">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <Link
                    href={`/vehicles/${vehicle.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-raised"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden>{VEHICLE_TYPES[vehicle.vehicle_type].icon}</span>
                      <span className="truncate font-medium text-ink">{vehicleTitle(vehicle)}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">
                      {vehicle.tracks_engine_hours
                        ? formatHours(vehicle.current_engine_hours)
                        : formatMiles(vehicle.current_mileage)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 *   ⚠️ RZR Drive Belt
 *      Inspection due in 6 hours
 */
function AttentionRow({ item }: { item: AttentionItem }) {
  const { vehicle, part, schedule, due } = item;
  const task = TASK_TYPES[schedule.task_type].label;

  return (
    <Link
      href={`/vehicles/${vehicle.id}/parts/${part.id}`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 py-3.5 transition hover:bg-raised"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <span aria-hidden>{DUE_LEVEL_ICON[due.level]}</span>
          <span className="truncate">
            <span className="text-muted">{vehicleTitle(vehicle)}</span> {part.name}
          </span>
        </p>
        <p
          className={`mt-0.5 pl-6 text-sm ${
            due.level === "OVERDUE" || due.level === "DUE"
              ? "text-bad"
              : due.level === "DUE_SOON"
                ? "text-warn"
                : "text-muted"
          }`}
        >
          {task} · {describeRemaining(due)}
        </p>
      </div>
      <Pill tone="muted">{describeNextDue(due)}</Pill>
    </Link>
  );
}
