import Link from "next/link";
import { notFound } from "next/navigation";

import { partSubtitle } from "@/components/parts";
import { EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { describeRemaining, formatHours, formatMiles, formatMoney, pluralize } from "@/lib/format";
import { buildSheet, getUsage, getVehicle, vehicleCostSummary } from "@/lib/queries";
import type { PartDetail } from "@/lib/queries";

/**
 * The build sheet, set as a parts catalogue: sections numbered, entries keyed
 * to their section, figures aligned on one right-hand axis. The numbering is
 * information here — a build sheet really is a catalogue of what is fitted —
 * so 2.3 identifies an entry rather than decorating it.
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
    <div className="space-y-8">
      <PageHeader
        title="Build sheet"
        description={`${pluralize(totalParts, "item")} currently fitted${
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

      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-2 border-y-2 border-ink py-4">
        <p>
          <span className="readout text-3xl text-ink">{formatMoney(costs.modificationCents)}</span>
          <span className="ml-2 text-sm text-muted">in modifications</span>
        </p>
        <p>
          <span className="readout text-3xl text-ink">{formatMoney(costs.totalCents)}</span>
          <span className="ml-2 text-sm text-muted">invested overall</span>
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="border border-line bg-surface">
          <EmptyState
            icon="🧾"
            title="Nothing on the build sheet yet"
            description={
              includeEverything
                ? "Add a part to this vehicle and it appears here, grouped by category."
                : "Add a part and tick “Show on the build sheet” to have it listed here."
            }
            action={
              <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
                Add part
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-9">
          {sections.map((section, sectionIndex) => {
            let entry = 0;

            return (
              <section key={section.group}>
                <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-1.5">
                  <h2 className="display flex items-baseline gap-3 text-lg text-ink">
                    <span className="tabular-nums text-muted">{sectionIndex + 1}</span>
                    {section.label}
                  </h2>
                  <p className="flex items-baseline gap-4 text-sm">
                    <span className="text-muted">{pluralize(section.partCount, "item")}</span>
                    {section.totalCents != null ? (
                      <span className="readout text-base text-ink">{formatMoney(section.totalCents)}</span>
                    ) : null}
                  </p>
                </div>

                {section.categories.map((category) => (
                  <div key={category.category}>
                    {section.categories.length > 1 ? (
                      <p className="border-b border-line py-1.5 text-sm text-muted">{category.label}</p>
                    ) : null}
                    <ul>
                      {category.parts.map((detail) => (
                        <li key={detail.part.id}>
                          <Entry
                            detail={detail}
                            vehicleId={vehicle.id}
                            number={`${sectionIndex + 1}.${++entry}`}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One catalogue entry: key, what it is, when it went on, what it cost. */
function Entry({
  detail,
  vehicleId,
  number,
}: {
  detail: PartDetail;
  vehicleId: string;
  number: string;
}) {
  const { part, topDue, totalCents } = detail;
  const subtitle = partSubtitle(part);
  const readings = [
    part.installed_mileage != null ? formatMiles(part.installed_mileage) : null,
    part.installed_hours != null ? formatHours(part.installed_hours) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/vehicles/${vehicleId}/parts/${part.id}`}
      className="flex items-baseline gap-4 border-b border-line py-3 transition hover:bg-raised"
    >
      <span className="w-10 shrink-0 tabular-nums text-sm text-faint">{number}</span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-medium text-ink">{part.name}</span>
          {part.is_oem ? <span className="text-xs text-muted">factory</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {subtitle ? `${subtitle}. ` : ""}
          {part.installed_on ? `Fitted ${formatDate(part.installed_on)}` : "No install date"}
          {readings ? ` at ${readings}` : ""}
        </span>
      </span>

      {topDue ? (
        <span
          className={`shrink-0 text-right text-sm tabular-nums ${
            topDue.due.level === "OVERDUE" || topDue.due.level === "DUE"
              ? "text-bad"
              : topDue.due.level === "DUE_SOON"
                ? "text-warn"
                : "text-muted"
          }`}
        >
          {describeRemaining(topDue.due)}
        </span>
      ) : null}

      <span className="w-24 shrink-0 text-right tabular-nums text-ink">
        {totalCents != null ? formatMoney(totalCents) : "—"}
      </span>
    </Link>
  );
}
