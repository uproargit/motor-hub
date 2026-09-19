import Link from "next/link";

import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { VEHICLE_TYPES } from "@/lib/domain";
import { formatHours, formatMiles, formatMoney, pluralize } from "@/lib/format";
import { childrenOf, groupedFleet } from "@/lib/fleet";
import { costSummaryFrom, partCountsFrom, vehicleTitle, vehicleDescription } from "@/lib/part-logic";
import { attentionItems, costSummaryByVehicle, countPartsByVehicle, listVehicles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  // Every roll-up is fetched for the whole fleet at once. Per-vehicle reads
  // here would cost three round-trips per card, which grows with the fleet.
  const fleet = await listVehicles(true);

  const [countsByVehicle, costsByVehicle, attention] = await Promise.all([
    countPartsByVehicle(),
    costSummaryByVehicle(),
    attentionItems({ fleet, levels: ["OVERDUE", "DUE", "DUE_SOON"] }),
  ]);

  const vehicles = groupedFleet(fleet);
  const byId = new Map(fleet.map((vehicle) => [vehicle.id, vehicle]));

  const cards = vehicles.map((vehicle) => ({
    vehicle,
    counts: countsByVehicle.get(vehicle.id) ?? partCountsFrom(null),
    costs: costsByVehicle.get(vehicle.id) ?? costSummaryFrom(null, null),
    attention: attention.filter((item) => item.vehicle.id === vehicle.id),
    type: VEHICLE_TYPES[vehicle.vehicle_type],
    parent: vehicle.parent_vehicle_id ? (byId.get(vehicle.parent_vehicle_id) ?? null) : null,
    attached: childrenOf(fleet, vehicle.id),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Every machine you own, with its build, its parts and its service record."
        actions={
          <Link href="/vehicles/new" className="btn-primary">
            Add vehicle
          </Link>
        }
      />

      {vehicles.length === 0 ? (
        <Card>
          <EmptyState
            icon="🚗"
            title="No vehicles yet"
            description="Add your first vehicle to start building its parts history and build sheet."
            action={
              <Link href="/vehicles/new" className="btn-primary">
                Add vehicle
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ vehicle, counts, costs, attention, type, parent, attached }) => {
            return (
              <li key={vehicle.id}>
                <Link
                  href={`/vehicles/${vehicle.id}`}
                  className="card block h-full p-5 transition hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span aria-hidden className="text-lg">
                          {type.icon}
                        </span>
                        <h2 className="truncate text-lg font-bold text-ink">{vehicleTitle(vehicle)}</h2>
                        {vehicle.archived ? <Pill tone="muted">Archived</Pill> : null}
                      </div>
                      {vehicle.nickname ? (
                        <p className="mt-0.5 text-sm text-muted">{vehicleDescription(vehicle)}</p>
                      ) : null}
                      {parent ? (
                        <p className="mt-0.5 text-sm text-muted">Goes with {vehicleTitle(parent)}</p>
                      ) : null}
                      {attached.length > 0 ? (
                        <p className="mt-0.5 text-sm text-muted">
                          With {attached.map((item) => vehicleTitle(item)).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {attention.length > 0 ? (
                      <Pill tone={attention[0].due.level === "DUE_SOON" ? "warn" : "bad"}>
                        {pluralize(attention.length, "item")} due
                      </Pill>
                    ) : null}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {vehicle.tracks_mileage ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Odometer</dt>
                        <dd className="font-semibold tabular-nums text-ink">{formatMiles(vehicle.current_mileage)}</dd>
                      </div>
                    ) : null}
                    {vehicle.tracks_engine_hours ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted">Engine hours</dt>
                        <dd className="font-semibold tabular-nums text-ink">{formatHours(vehicle.current_engine_hours)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Parts installed</dt>
                      <dd className="font-semibold tabular-nums text-ink">{counts.installed}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Modification cost</dt>
                      <dd className="font-semibold tabular-nums text-ink">{formatMoney(costs.modificationCents)}</dd>
                    </div>
                  </dl>

                  {vehicle.usage_updated_on ? (
                    <p className="mt-3 text-xs text-faint">Reading updated {formatDate(vehicle.usage_updated_on)}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
