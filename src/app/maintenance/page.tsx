import Link from "next/link";

import { ScheduleCard } from "@/components/schedule";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import type { DueLevel } from "@/lib/due";
import { DUE_LEVEL_LABEL } from "@/lib/format";
import { vehicleTitle } from "@/lib/part-logic";
import { attentionItems, fleetStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SECTIONS: DueLevel[] = ["OVERDUE", "DUE", "DUE_SOON", "OK", "UNKNOWN"];

export default function MaintenancePage() {
  const items = attentionItems();
  const stats = fleetStats();

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Every active schedule across the fleet, ranked by urgency." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Overdue" value={stats.overdue} tone={stats.overdue ? "bad" : "muted"} />
        <Stat label="Due soon" value={stats.dueSoon} tone={stats.dueSoon ? "warn" : "muted"} />
        <Stat label="Tracked schedules" value={items.length} />
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon="🗓️"
            title="No maintenance schedules yet"
            description="Open any part and add an interval in miles, engine hours or months."
            action={
              <Link href="/vehicles" className="btn-secondary">
                Browse vehicles
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {SECTIONS.map((level) => {
            const sectionItems = items.filter((item) => item.due.level === level);
            if (sectionItems.length === 0) return null;

            return (
              <Card key={level}>
                <CardHeader title={DUE_LEVEL_LABEL[level]} subtitle={`${sectionItems.length} item(s)`} />
                <ul className="space-y-3 p-4">
                  {sectionItems.map((item) => (
                    <li key={item.schedule.id}>
                      <Link href={`/vehicles/${item.vehicle.id}/parts/${item.part.id}`} className="block">
                        <p className="mb-1.5 text-sm font-semibold text-ink">
                          <span className="text-muted">{vehicleTitle(item.vehicle)} · </span>
                          {item.part.name}
                        </p>
                        <ScheduleCard schedule={item.schedule} due={item.due} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
