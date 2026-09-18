import Link from "next/link";
import { notFound } from "next/navigation";

import { PartList } from "@/components/parts";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PART_CATEGORIES, PART_CATEGORY_KEYS, PART_STATUSES, PART_STATUS_KEYS, type PartCategory } from "@/lib/domain";
import { formatMoney, pluralize } from "@/lib/format";
import { decorateParts, getUsage, getVehicle, listParts, type PartFilter } from "@/lib/queries";

const STATUS_FILTERS = [
  { value: "CURRENT", label: "Installed" },
  { value: "HISTORY", label: "Off the vehicle" },
  { value: "ALL", label: "Everything" },
  ...PART_STATUS_KEYS.map((key) => ({ value: key, label: PART_STATUSES[key].label })),
];

export default async function PartsPage({
  params,
  searchParams,
}: {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const { vehicleId } = await params;
  const query = await searchParams;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const status = (query.status ?? "CURRENT") as PartFilter["status"];
  const category = query.category && query.category in PART_CATEGORIES ? (query.category as PartCategory) : undefined;
  const search = query.q?.trim() || undefined;

  const usage = getUsage(vehicle);
  const parts = await decorateParts(await listParts(vehicle.id, { status, category, search }), usage);
  const totalCents = parts.reduce((sum, detail) => sum + (detail.totalCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parts & modifications"
        description="Nothing is ever overwritten — replaced parts stay here with their full history."
        actions={
          <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
            Add part
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 px-5 py-4" action={`/vehicles/${vehicle.id}/parts`}>
          <div className="min-w-[10rem] flex-1">
            <label className="label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              defaultValue={search ?? ""}
              placeholder="Name, brand, part number, shop…"
              className="field mt-1.5"
            />
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={status} className="field mt-1.5">
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select id="category" name="category" defaultValue={category ?? ""} className="field mt-1.5">
              <option value="">All categories</option>
              {PART_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PART_CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            Apply
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={pluralize(parts.length, "part")}
          subtitle={totalCents > 0 ? `${formatMoney(totalCents)} across these parts` : undefined}
        />
        {parts.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No parts match"
            description="Try a different status or clear the search."
            action={
              <Link href={`/vehicles/${vehicle.id}/parts?status=ALL`} className="btn-secondary">
                Show everything
              </Link>
            }
          />
        ) : (
          <PartList parts={parts} vehicleId={vehicle.id} showCategory />
        )}
      </Card>
    </div>
  );
}
