import Link from "next/link";

import { deleteAttachmentAction } from "@/lib/actions/attachments";
import { formatDate } from "@/lib/dates";
import { ATTACHMENT_KINDS, categoryLabel, type PartStatus } from "@/lib/domain";
import { describeRemaining, formatBytes, formatHours, formatMiles, formatMoney } from "@/lib/format";
import type { PartDetail } from "@/lib/queries";
import type { AttachmentRow } from "@/lib/types";
import { isImage } from "@/lib/mime";

import { DuePill, Pill, StatusPill } from "./ui";

/** Manufacturer · part number · quantity, skipping whatever is not recorded. */
export function partSubtitle(part: PartDetail["part"]): string {
  const bits = [part.manufacturer, part.part_number ? `#${part.part_number}` : null];
  if (part.quantity !== 1) bits.push(`×${part.quantity}`);
  return bits.filter(Boolean).join(", ");
}

/**
 * A single part in a list or on the build sheet. Always links through to the
 * full installation and service history.
 */
export function PartLine({
  detail,
  vehicleId,
  showCategory = false,
  showCost = true,
}: {
  detail: PartDetail;
  vehicleId: string;
  showCategory?: boolean;
  showCost?: boolean;
}) {
  const { part, topDue, totalCents } = detail;
  const subtitle = partSubtitle(part);
  const readings = [
    part.installed_mileage != null ? formatMiles(part.installed_mileage) : null,
    part.installed_hours != null ? formatHours(part.installed_hours) : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Link
      href={`/vehicles/${vehicleId}/parts/${part.id}`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-raised"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{part.name}</span>
          {part.status !== "INSTALLED" ? <StatusPill status={part.status as PartStatus} /> : null}
          {showCategory ? <Pill tone="muted">{categoryLabel(part.category)}</Pill> : null}
          {part.is_oem ? <Pill tone="info">OEM</Pill> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {subtitle ? `${subtitle} · ` : ""}
          {part.installed_on ? `Installed ${formatDate(part.installed_on)}` : "No install date"}
          {readings ? ` at ${readings}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {topDue ? <DuePill level={topDue.due.level} label={describeRemaining(topDue.due)} /> : null}
        {showCost && totalCents != null ? (
          <span className="tabular-nums text-sm font-semibold text-ink">{formatMoney(totalCents)}</span>
        ) : null}
      </div>
    </Link>
  );
}

export function PartList({
  parts,
  vehicleId,
  showCategory = false,
}: {
  parts: PartDetail[];
  vehicleId: string;
  showCategory?: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {parts.map((detail) => (
        <li key={detail.part.id}>
          <PartLine detail={detail} vehicleId={vehicleId} showCategory={showCategory} />
        </li>
      ))}
    </ul>
  );
}

/** Photos as a thumbnail grid, documents as a list, both individually removable. */
export function AttachmentGallery({
  attachments,
  emptyLabel = "No files yet.",
}: {
  attachments: AttachmentRow[];
  emptyLabel?: string;
}) {
  if (attachments.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  const photos = attachments.filter((attachment) => isImage(attachment.mime_type));
  const documents = attachments.filter((attachment) => !isImage(attachment.mime_type));

  return (
    <div className="space-y-4">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((attachment) => (
            <li key={attachment.id} className="group relative overflow-hidden rounded-lg border border-line">
              <a href={`/api/files/${attachment.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${attachment.id}`}
                  alt={attachment.caption ?? attachment.file_name}
                  className="aspect-[4/3] w-full bg-raised object-cover"
                />
              </a>
              <div className="flex items-center justify-between gap-2 border-t border-line bg-surface px-2 py-1.5">
                <span className="truncate text-xs text-muted" title={attachment.file_name}>
                  {attachment.caption ?? ATTACHMENT_KINDS[attachment.kind]}
                </span>
                <DeleteAttachmentButton id={attachment.id} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {documents.length > 0 ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {documents.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <a
                href={`/api/files/${attachment.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 text-sm font-medium text-ink hover:text-accent"
              >
                <span className="mr-1.5" aria-hidden>
                  📄
                </span>
                <span className="break-all">{attachment.file_name}</span>
              </a>
              <span className="shrink-0 text-xs text-muted">
                {ATTACHMENT_KINDS[attachment.kind]} · {formatBytes(attachment.size_bytes)}
              </span>
              <DeleteAttachmentButton id={attachment.id} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeleteAttachmentButton({ id }: { id: string }) {
  return (
    <form action={deleteAttachmentAction}>
      <input type="hidden" name="attachment_id" value={id} />
      <button
        type="submit"
        aria-label="Delete file"
        className="rounded px-1.5 text-xs text-faint transition hover:text-bad"
      >
        ✕
      </button>
    </form>
  );
}
