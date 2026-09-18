import Link from "next/link";
import { notFound } from "next/navigation";

import { ScheduleCard } from "@/components/schedule";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { UsageForm } from "@/components/usage-form";
import { formatDate } from "@/lib/dates";
import { DUE_LEVEL_LABEL, formatHours, formatMiles } from "@/lib/format";
import { attentionItems, getVehicle, listUsageReadings } from "@/lib/queries";
import type { DueLevel } from "@/lib/due";

const SECTIONS: Array<{ level: DueLevel; tone: "bad" | "warn" | "good" | "muted" }> = [
  { level: "OVERDUE", tone: "bad" },
  { level: "DUE", tone: "bad" },
  { level: "DUE_SOON", tone: "warn" },
  { level: "OK", tone: "good" },
  { level: "UNKNOWN", tone: "muted" },
];

export default async function VehicleMaintenancePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const [items, readings] = await Promise.all([
    attentionItems({ vehicleId: vehicle.id }),
    listUsageReadings(vehicle.id, 10),
  ]);
  const counts = {
    overdue: items.filter((item) => item.due.level === "OVERDUE" || item.due.level === "DUE").length,
    soon: items.filter((item) => item.due.level === "DUE_SOON").length,
    ok: items.filter((item) => item.due.level === "OK").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Every active schedule on parts currently fitted to this vehicle."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "bad" : "muted"} />
        <Stat label="Due soon" value={counts.soon} tone={counts.soon ? "warn" : "muted"} />
        <Stat label="On schedule" value={counts.ok} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {items.length === 0 ? (
            <Card>
              <EmptyState
                icon="🗓️"
                title="No schedules yet"
                description="Open a part and add an interval in miles, engine hours or months."
                action={
                  <Link href={`/vehicles/${vehicle.id}/parts`} className="btn-secondary">
                    Browse parts
                  </Link>
                }
              />
            </Card>
          ) : (
            SECTIONS.map((section) => {
              const sectionItems = items.filter((item) => item.due.level === section.level);
              if (sectionItems.length === 0) return null;

              return (
                <Card key={section.level}>
                  <CardHeader title={DUE_LEVEL_LABEL[section.level]} subtitle={`${sectionItems.length} item(s)`} />
                  <ul className="space-y-3 p-4">
                    {sectionItems.map((item) => (
                      <li key={item.schedule.id}>
                        <Link href={`/vehicles/${vehicle.id}/parts/${item.part.id}`} className="block">
                          <p className="mb-1.5 text-sm font-semibold text-ink">{item.part.name}</p>
                          <ScheduleCard schedule={item.schedule} due={item.due} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Update readings" subtitle="Due dates recalculate immediately." />
            <UsageForm vehicle={vehicle} />
          </Card>

          <Card>
            <CardHeader title="Reading history" />
            {readings.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No readings recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {readings.map((reading) => (
                  <li key={reading.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="text-muted">{formatDate(reading.recorded_on)}</span>
                    <span className="tabular-nums font-medium text-ink">
                      {[
                        reading.mileage != null ? formatMiles(reading.mileage) : null,
                        reading.engine_hours != null ? formatHours(reading.engine_hours) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
