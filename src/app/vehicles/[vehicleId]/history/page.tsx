import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { formatDate, formatDateLong } from "@/lib/dates";
import { DISPOSITIONS, INSTALLED_BY, TASK_TYPES, type Disposition } from "@/lib/domain";
import { formatHours, formatMiles, formatMoney } from "@/lib/format";
import { totalInstalledCents } from "@/lib/part-logic";
import { getVehicle, vehicleTimeline, type TimelineEvent } from "@/lib/queries";

const EVENT_META: Record<TimelineEvent["kind"], { icon: string; label: string; tone: "good" | "muted" | "info" | "accent" }> = {
  INSTALL: { icon: "🔧", label: "Installed", tone: "good" },
  REMOVAL: { icon: "📤", label: "Removed", tone: "muted" },
  SERVICE: { icon: "🧰", label: "Serviced", tone: "info" },
  READING: { icon: "📈", label: "Reading", tone: "accent" },
};

/**
 * The complete chronological record for a vehicle: what went on, what came off,
 * what was serviced and what the meters read at the time.
 */
export default async function VehicleHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ readings?: string }>;
}) {
  const { vehicleId } = await params;
  const { readings } = await searchParams;
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) notFound();

  const includeReadings = readings === "1";
  const events = vehicleTimeline(vehicle.id, { includeReadings });

  // Group by month so a long history stays scannable.
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = event.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="A permanent record — replaced parts keep their entries."
        actions={
          <Link
            href={`/vehicles/${vehicle.id}/history${includeReadings ? "" : "?readings=1"}`}
            className="btn-secondary"
          >
            {includeReadings ? "Hide meter readings" : "Show meter readings"}
          </Link>
        }
      />

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon="📜"
            title="Nothing recorded yet"
            description="Add a part with an install date and it will show up here."
            action={
              <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
                Add part
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([month, monthEvents]) => (
            <Card key={month}>
              <CardHeader
                title={new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                subtitle={`${monthEvents.length} event${monthEvents.length === 1 ? "" : "s"}`}
              />
              <ul className="divide-y divide-line">
                {monthEvents.map((event, index) => (
                  <li key={`${event.kind}-${index}`} className="flex gap-3.5 px-5 py-4">
                    <span aria-hidden className="mt-0.5 text-lg">
                      {EVENT_META[event.kind].icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <TimelineBody event={event} vehicleId={vehicle.id} />
                    </div>
                    <time className="shrink-0 text-xs text-faint" dateTime={event.date}>
                      {formatDate(event.date)}
                    </time>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineBody({ event, vehicleId }: { event: TimelineEvent; vehicleId: string }) {
  if (event.kind === "READING") {
    return (
      <p className="text-sm text-ink">
        Meter reading:{" "}
        <span className="font-semibold tabular-nums">
          {[
            event.reading.mileage != null ? formatMiles(event.reading.mileage) : null,
            event.reading.engine_hours != null ? formatHours(event.reading.engine_hours) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </p>
    );
  }

  const partLink = (
    <Link href={`/vehicles/${vehicleId}/parts/${event.part.id}`} className="font-semibold text-ink hover:text-accent">
      {event.part.name}
    </Link>
  );

  if (event.kind === "INSTALL") {
    const cost = totalInstalledCents(event.part);
    return (
      <>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone="good">Installed</Pill>
          {partLink}
        </p>
        <p className="mt-1 text-sm text-muted">
          {[
            event.part.manufacturer,
            event.part.installed_mileage != null ? `at ${formatMiles(event.part.installed_mileage)}` : null,
            event.part.installed_hours != null ? `at ${formatHours(event.part.installed_hours)}` : null,
            `by ${INSTALLED_BY[event.part.installed_by]}`,
            event.part.installer_name,
            cost != null ? formatMoney(cost) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </>
    );
  }

  if (event.kind === "REMOVAL") {
    return (
      <>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={event.part.status === "FAILED" ? "bad" : "muted"}>
            {event.part.status === "REPLACED" ? "Replaced" : "Removed"}
          </Pill>
          {partLink}
        </p>
        <p className="mt-1 text-sm text-muted">
          {[
            event.part.removal_reason ? `Reason: ${event.part.removal_reason}` : null,
            event.part.removed_mileage != null ? `at ${formatMiles(event.part.removed_mileage)}` : null,
            event.part.removed_hours != null ? `at ${formatHours(event.part.removed_hours)}` : null,
            event.part.disposition ? DISPOSITIONS[event.part.disposition as Disposition] : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {event.replacedBy ? (
          <p className="mt-1 text-sm">
            <span className="text-muted">Replaced by </span>
            <Link
              href={`/vehicles/${vehicleId}/parts/${event.replacedBy.id}`}
              className="font-medium text-accent hover:underline"
            >
              {event.replacedBy.name}
            </Link>
            <span className="text-muted"> on {formatDateLong(event.replacedBy.installed_on)}</span>
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Pill tone="info">{TASK_TYPES[event.record.task_type].label}</Pill>
        {partLink}
      </p>
      <p className="mt-1 text-sm text-muted">
        {[
          event.record.mileage != null ? formatMiles(event.record.mileage) : null,
          event.record.engine_hours != null ? formatHours(event.record.engine_hours) : null,
          event.record.performer_name ?? INSTALLED_BY[event.record.performed_by],
          event.record.outcome,
          event.record.cost_cents != null ? formatMoney(event.record.cost_cents) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {event.record.notes ? <p className="mt-1 text-sm text-muted">{event.record.notes}</p> : null}
    </>
  );
}
