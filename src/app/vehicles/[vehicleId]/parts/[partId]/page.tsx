import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddAttachmentsForm,
  AddScheduleForm,
  EditScheduleForm,
  LogServiceForm,
} from "@/components/part-actions";
import { AttachmentGallery, partSubtitle } from "@/components/parts";
import { ScheduleCard } from "@/components/schedule";
import { Card, CardHeader, DetailList, EmptyState, Pill, StatusPill } from "@/components/ui";
import { deletePartAction, reinstallPartAction } from "@/lib/actions/parts";
import { deleteScheduleAction, deleteServiceRecordAction, toggleScheduleAction } from "@/lib/actions/maintenance";
import { formatDate } from "@/lib/dates";
import {
  categoryLabel,
  DISPOSITIONS,
  INSTALLED_BY,
  TASK_TYPES,
  WARRANTY_TYPES,
  type Disposition,
  type PartStatus,
} from "@/lib/domain";
import { formatHours, formatMiles, formatMoney } from "@/lib/format";
import { isOnVehicle, warrantyStanding } from "@/lib/part-logic";
import {
  getPartDetail,
  getUsage,
  getVehicle,
  listPartAttachments,
  listServiceRecords,
  partLineage,
} from "@/lib/queries";

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string; partId: string }>;
}) {
  const { vehicleId, partId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const usage = getUsage(vehicle);
  const detail = await getPartDetail(partId, usage);
  if (!detail || detail.part.vehicle_id !== vehicle.id) notFound();

  const { part, schedules, totalCents } = detail;
  const [attachments, services, lineage] = await Promise.all([
    listPartAttachments(part.id),
    listServiceRecords(part.id),
    partLineage(part),
  ]);
  const warranty = warrantyStanding(part, usage);
  const onVehicle = isOnVehicle(part);
  const base = `/vehicles/${vehicle.id}/parts/${part.id}`;

  const previous = lineage[lineage.indexOf(part) - 1] ?? null;
  const next = lineage[lineage.indexOf(part) + 1] ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/vehicles/${vehicle.id}/parts`}
            className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-ink"
          >
            ← All parts
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{part.name}</h1>
            <StatusPill status={part.status as PartStatus} />
            {part.is_oem ? <Pill tone="info">OEM</Pill> : null}
            {part.is_modification ? <Pill tone="accent">Build sheet</Pill> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {categoryLabel(part.category)}
            {partSubtitle(part) ? ` · ${partSubtitle(part)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`${base}/edit`} className="btn-secondary">
            Edit
          </Link>
          {onVehicle ? (
            <>
              <Link href={`${base}/replace`} className="btn-primary">
                Replace
              </Link>
              <Link href={`${base}/remove`} className="btn-secondary">
                Remove
              </Link>
            </>
          ) : (
            <form action={reinstallPartAction}>
              <input type="hidden" name="part_id" value={part.id} />
              <button type="submit" className="btn-secondary">
                Put back on
              </button>
            </form>
          )}
        </div>
      </header>

      {previous || next ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
          <span className="font-semibold text-ink">Replacement chain</span>
          {previous ? (
            <Link href={`/vehicles/${vehicle.id}/parts/${previous.id}`} className="text-accent hover:underline">
              ← Replaced {previous.name}
            </Link>
          ) : null}
          {next ? (
            <Link href={`/vehicles/${vehicle.id}/parts/${next.id}`} className="text-accent hover:underline">
              Replaced by {next.name} →
            </Link>
          ) : null}
          <span className="text-muted">
            {lineage.length} {lineage.length === 1 ? "part" : "parts"} in this chain
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Installation" />
            <div className="px-5 py-4">
              <DetailList
                items={[
                  { label: "Date installed", value: part.installed_on ? formatDate(part.installed_on) : "—" },
                  {
                    label: "Mileage at install",
                    value: part.installed_mileage != null ? formatMiles(part.installed_mileage) : null,
                  },
                  {
                    label: "Engine hours at install",
                    value: part.installed_hours != null ? formatHours(part.installed_hours) : null,
                  },
                  { label: "Installed by", value: INSTALLED_BY[part.installed_by] },
                  { label: "Installer / shop", value: part.installer_name },
                  { label: "Phone", value: part.installer_phone },
                  { label: "Email", value: part.installer_email },
                  { label: "Address", value: part.installer_address },
                  { label: "Quantity", value: part.quantity !== 1 ? part.quantity : null },
                  { label: "Install notes", value: part.install_notes },
                ]}
              />
            </div>
          </Card>

          {!onVehicle ? (
            <Card>
              <CardHeader title="Removal" subtitle="Kept on the record permanently." />
              <div className="px-5 py-4">
                <DetailList
                  items={[
                    { label: "Date removed", value: part.removed_on ? formatDate(part.removed_on) : "—" },
                    {
                      label: "Mileage at removal",
                      value: part.removed_mileage != null ? formatMiles(part.removed_mileage) : null,
                    },
                    {
                      label: "Engine hours at removal",
                      value: part.removed_hours != null ? formatHours(part.removed_hours) : null,
                    },
                    { label: "Reason", value: part.removal_reason },
                    {
                      label: "Disposition",
                      value: part.disposition ? DISPOSITIONS[part.disposition as Disposition] : null,
                    },
                    {
                      label: "Sold for",
                      value: part.sale_price_cents != null ? formatMoney(part.sale_price_cents) : null,
                    },
                  ]}
                />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Maintenance schedules"
              subtitle={
                onVehicle
                  ? "Intervals run from the install point and restart each time the task is logged."
                  : "Paused — the part is off the vehicle."
              }
            />
            {schedules.length === 0 ? (
              <EmptyState
                icon="🗓️"
                title="No schedule on this part"
                description="Add an interval in miles, engine hours or months and the next service is calculated for you."
              />
            ) : (
              <ul className="space-y-3 p-4">
                {schedules.map(({ schedule, due }) => (
                  <li key={schedule.id}>
                    <ScheduleCard
                      schedule={schedule}
                      due={due}
                      readingHref={`/vehicles/${vehicle.id}/maintenance`}
                      actions={
                        <>
                          <form action={toggleScheduleAction}>
                            <input type="hidden" name="schedule_id" value={schedule.id} />
                            <button type="submit" className="btn-ghost px-2 py-1 text-xs">
                              {schedule.is_active ? "Pause" : "Resume"}
                            </button>
                          </form>
                          <form action={deleteScheduleAction}>
                            <input type="hidden" name="schedule_id" value={schedule.id} />
                            <button type="submit" className="btn-ghost px-2 py-1 text-xs hover:text-bad">
                              Delete
                            </button>
                          </form>
                        </>
                      }
                    />
                    <EditScheduleForm schedule={schedule} vehicle={vehicle} />
                  </li>
                ))}
              </ul>
            )}
            <AddScheduleForm part={part} vehicle={vehicle} />
          </Card>

          <Card>
            <CardHeader title="Service history" subtitle={`${services.length} recorded`} />
            {services.length === 0 ? (
              <EmptyState icon="🧰" title="No service logged yet" description="Log an inspection or service below." />
            ) : (
              <ul className="divide-y divide-line">
                {services.map((record) => (
                  <li key={record.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {TASK_TYPES[record.task_type].label}
                        <span className="ml-2 text-sm font-normal text-muted">{formatDate(record.performed_on)}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {[
                          record.mileage != null ? formatMiles(record.mileage) : null,
                          record.engine_hours != null ? formatHours(record.engine_hours) : null,
                          record.performer_name ?? INSTALLED_BY[record.performed_by],
                          record.outcome,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {record.notes ? <p className="mt-1 text-sm text-muted">{record.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {record.cost_cents != null ? (
                        <span className="tabular-nums text-sm font-semibold text-ink">
                          {formatMoney(record.cost_cents)}
                        </span>
                      ) : null}
                      <form action={deleteServiceRecordAction}>
                        <input type="hidden" name="service_record_id" value={record.id} />
                        <button type="submit" aria-label="Delete record" className="text-xs text-faint hover:text-bad">
                          ✕
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <LogServiceForm part={part} vehicle={vehicle} schedules={schedules.map((entry) => entry.schedule)} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Cost" />
            <dl className="divide-y divide-line">
              {[
                { label: "Part", value: part.part_cost_cents },
                { label: "Labor", value: part.labor_cost_cents },
                { label: "Shipping", value: part.shipping_cost_cents },
                { label: "Tax", value: part.tax_cents },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-semibold tabular-nums text-ink">{formatMoney(row.value)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 bg-raised px-5 py-3">
                <dt className="text-sm font-semibold text-ink">Total installed cost</dt>
                <dd className="text-base font-bold tabular-nums text-ink">{formatMoney(totalCents)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Warranty"
              action={
                <Pill
                  tone={
                    warranty.state === "EXPIRED"
                      ? "bad"
                      : warranty.state === "ACTIVE" || warranty.state === "LIFETIME"
                        ? "good"
                        : "muted"
                  }
                >
                  {warranty.summary}
                </Pill>
              }
            />
            <div className="px-5 py-4">
              <DetailList
                items={[
                  { label: "Type", value: WARRANTY_TYPES[part.warranty_type] },
                  { label: "Provider", value: part.warranty_provider },
                  {
                    label: "Term",
                    value: part.warranty_months ? `${part.warranty_months} months` : null,
                  },
                  {
                    label: "Mileage limit",
                    value: part.warranty_miles ? formatMiles(part.warranty_miles) : null,
                  },
                  {
                    label: "Hour limit",
                    value: part.warranty_hours ? formatHours(part.warranty_hours) : null,
                  },
                  { label: "Expires", value: warranty.expiresOn ? formatDate(warranty.expiresOn) : null },
                  { label: "Notes", value: part.warranty_notes },
                ]}
              />
              {warranty.reasons.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
                  {warranty.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Purchase" />
            <div className="px-5 py-4">
              <DetailList
                items={[
                  { label: "Vendor", value: part.purchase_vendor },
                  { label: "Location", value: part.purchase_location },
                  { label: "Purchased", value: part.purchased_on ? formatDate(part.purchased_on) : null },
                  { label: "Order number", value: part.order_number },
                ]}
              />
              {!part.purchase_vendor && !part.purchase_location && !part.purchased_on && !part.order_number ? (
                <p className="text-sm text-muted">No purchase details recorded.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Receipts & photos" subtitle={`${attachments.length} on file`} />
            <div className="px-5 py-4">
              <AttachmentGallery attachments={attachments} emptyLabel="No receipts or photos yet." />
            </div>
            <AddAttachmentsForm part={part} />
          </Card>

          {part.description || part.notes ? (
            <Card>
              <CardHeader title="Description & notes" />
              <div className="space-y-3 px-5 py-4 text-sm text-muted">
                {part.description ? <p className="whitespace-pre-wrap">{part.description}</p> : null}
                {part.notes ? <p className="whitespace-pre-wrap">{part.notes}</p> : null}
              </div>
            </Card>
          ) : null}

          <Card className="border-bad/25">
            <CardHeader title="Delete this record" subtitle="Only for mistakes — use Replace to keep the history." />
            <form action={deletePartAction} className="px-5 py-4">
              <input type="hidden" name="part_id" value={part.id} />
              <button type="submit" className="btn-danger">
                Delete permanently
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
