import Link from "next/link";
import { notFound } from "next/navigation";

import { PartList } from "@/components/parts";
import { ScheduleCard } from "@/components/schedule";
import { Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { UsageForm } from "@/components/usage-form";
import { formatDate } from "@/lib/dates";
import { usageFieldsFor } from "@/lib/due";
import { formatHours, formatMiles, formatMoney, pluralize } from "@/lib/format";
import {
  attentionItems,
  countParts,
  decorateParts,
  getUsage,
  getVehicle,
  listParts,
  vehicleCostSummary,
} from "@/lib/queries";

export default async function VehicleOverviewPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const usage = getUsage(vehicle);
  const [counts, costs, schedules, installed] = await Promise.all([
    countParts(vehicle.id),
    vehicleCostSummary(vehicle.id),
    attentionItems({ vehicleId: vehicle.id }),
    listParts(vehicle.id, { status: "CURRENT" }),
  ]);
  const recent = await decorateParts(installed.slice(0, 6), usage);

  // attentionItems filters by level in JS, so asking for every level costs no
  // extra query and leaves the full schedule set for the reading form below.
  const attention = schedules.filter((item) =>
    item.due.level === "OVERDUE" || item.due.level === "DUE" || item.due.level === "DUE_SOON",
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Parts installed"
          value={counts.installed}
          hint={`${pluralize(counts.total, "record")} in total`}
          href={`/vehicles/${vehicle.id}/parts`}
        />
        <Stat
          label="Modification cost"
          value={formatMoney(costs.modificationCents)}
          hint={`${formatMoney(costs.totalCents)} including maintenance`}
          href={`/vehicles/${vehicle.id}/build-sheet`}
        />
        <Stat
          label="Needs attention"
          value={attention.length}
          tone={attention.some((item) => item.due.level !== "DUE_SOON") ? "bad" : attention.length ? "warn" : "muted"}
          hint={attention.length ? "Parts due for service" : "Everything on schedule"}
          href={`/vehicles/${vehicle.id}/maintenance`}
        />
        <Stat
          label={vehicle.tracks_engine_hours ? "Engine hours" : "Odometer"}
          value={vehicle.tracks_engine_hours ? formatHours(vehicle.current_engine_hours) : formatMiles(vehicle.current_mileage)}
          hint={vehicle.usage_updated_on ? `Updated ${formatDate(vehicle.usage_updated_on)}` : "No reading yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Parts needing attention"
              subtitle={attention.length ? "Based on the current readings below." : undefined}
              action={
                <Link href={`/vehicles/${vehicle.id}/maintenance`} className="btn-ghost">
                  All schedules
                </Link>
              }
            />
            {attention.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Nothing due"
                description="Every scheduled part on this vehicle is within its interval."
              />
            ) : (
              <ul className="space-y-3 p-4">
                {attention.slice(0, 5).map((item) => (
                  <li key={item.schedule.id}>
                    <Link href={`/vehicles/${vehicle.id}/parts/${item.part.id}`} className="block">
                      <ScheduleCard schedule={item.schedule} due={item.due} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Currently installed"
              action={
                <Link href={`/vehicles/${vehicle.id}/parts`} className="btn-ghost">
                  View all
                </Link>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                icon="🔩"
                title="No parts recorded yet"
                description="Add the first part or modification to start this vehicle's build sheet."
                action={
                  <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
                    Add part
                  </Link>
                }
              />
            ) : (
              <PartList parts={recent} vehicleId={vehicle.id} showCategory />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Current readings" subtitle="Everything due is calculated from these." />
            <UsageForm vehicle={vehicle} fields={usageFieldsFor(vehicle, schedules.map((item) => item.schedule))} />
          </Card>

          <Card>
            <CardHeader title="Spend" />
            <dl className="divide-y divide-line">
              {[
                { label: "Modifications", value: costs.modificationCents },
                { label: "Maintenance parts", value: costs.maintenanceCents },
                { label: "Service labor", value: costs.serviceCents },
                { label: "Parts & materials", value: costs.partsCents },
                { label: "Installation labor", value: costs.laborCents },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-semibold tabular-nums text-ink">{formatMoney(row.value)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 bg-raised px-5 py-3">
                <dt className="text-sm font-semibold text-ink">Total invested</dt>
                <dd className="text-base font-bold tabular-nums text-ink">{formatMoney(costs.totalCents)}</dd>
              </div>
            </dl>
          </Card>

          {vehicle.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-muted">{vehicle.notes}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
