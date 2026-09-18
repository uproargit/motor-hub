import Link from "next/link";
import { notFound } from "next/navigation";

import { PartLine } from "@/components/parts";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { formatMoney, pluralize } from "@/lib/format";
import { buildSheet, getUsage, getVehicle, vehicleCostSummary } from "@/lib/queries";

/**
 * The build sheet: everything currently fitted to the vehicle, grouped by
 * category, with each entry linking back to its full install and service
 * history.
 */
export default async function BuildSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { vehicleId } = await params;
  const { all } = await searchParams;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const includeEverything = all === "1";
  const usage = getUsage(vehicle);
  const [sections, costs] = await Promise.all([
    buildSheet(vehicle.id, usage, !includeEverything),
    vehicleCostSummary(vehicle.id),
  ]);
  const totalParts = sections.reduce((sum, section) => sum + section.partCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build sheet"
        description={`${pluralize(totalParts, "item")} currently installed${
          includeEverything ? ", including maintenance parts" : ""
        }`}
        actions={
          <>
            <Link
              href={`/vehicles/${vehicle.id}/build-sheet${includeEverything ? "" : "?all=1"}`}
              className="btn-secondary"
            >
              {includeEverything ? "Modifications only" : "Include maintenance parts"}
            </Link>
            <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
              Add part
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Pill tone="accent">{formatMoney(costs.modificationCents)} in modifications</Pill>
        <Pill tone="muted">{formatMoney(costs.totalCents)} invested overall</Pill>
      </div>

      {sections.length === 0 ? (
        <Card>
          <EmptyState
            icon="🧾"
            title="Nothing on the build sheet yet"
            description={
              includeEverything
                ? "Add a part to this vehicle and it will appear here, grouped by category."
                : "Add a part and tick “Show on the build sheet” to have it listed here."
            }
            action={
              <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
                Add part
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <Card key={section.group}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{section.icon}</span>
                    {section.label}
                  </span>
                }
                subtitle={pluralize(section.partCount, "item")}
                action={
                  section.totalCents != null ? (
                    <span className="tabular-nums text-sm font-semibold text-ink">
                      {formatMoney(section.totalCents)}
                    </span>
                  ) : null
                }
              />

              <div className="divide-y divide-line">
                {section.categories.map((category) => (
                  <div key={category.category}>
                    {section.categories.length > 1 ? (
                      <p className="bg-raised px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                        {category.label}
                      </p>
                    ) : null}
                    <ul className="divide-y divide-line">
                      {category.parts.map((detail) => (
                        <li key={detail.part.id}>
                          <PartLine detail={detail} vehicleId={vehicle.id} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
