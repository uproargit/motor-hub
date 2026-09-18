import "server-only";

import { all, one } from "./db";
import { todayIso } from "./dates";
import {
  CATEGORY_GROUPS,
  CATEGORY_GROUP_ORDER,
  categoryGroupOf,
  categoryLabel,
  type CategoryGroup,
  type PartCategory,
  type PartStatus,
} from "./domain";
import { compareDue, evaluateSchedule, type ScheduleDue } from "./due";
import { isOnVehicle, totalInstalledCents, usageOf } from "./part-logic";
import type {
  AttachmentRow,
  PartRow,
  ScheduleRow,
  ServiceRecordRow,
  UsageReadingRow,
  UsageSnapshot,
  VehicleRow,
} from "./types";

/** Sums the four cost columns; used wherever totals are aggregated in SQL. */
const COST_SUM =
  "COALESCE(part_cost_cents,0) + COALESCE(labor_cost_cents,0) + COALESCE(shipping_cost_cents,0) + COALESCE(tax_cents,0)";

/* -------------------------------------------------------------- vehicles -- */

export function listVehicles(includeArchived = false): Promise<VehicleRow[]> {
  return all<VehicleRow>(
    `SELECT * FROM vehicle
      WHERE (? = 1 OR archived = 0)
      ORDER BY archived ASC, year DESC, make ASC, model ASC`,
    [includeArchived ? 1 : 0],
  );
}

export function getVehicle(id: string): Promise<VehicleRow | null> {
  return one<VehicleRow>(`SELECT * FROM vehicle WHERE id = ?`, [id]);
}

export function getUsage(vehicle: VehicleRow): UsageSnapshot {
  return usageOf(vehicle, todayIso());
}

export function listUsageReadings(vehicleId: string, limit = 50): Promise<UsageReadingRow[]> {
  return all<UsageReadingRow>(
    `SELECT * FROM usage_reading WHERE vehicle_id = ? ORDER BY recorded_on DESC, created_at DESC LIMIT ?`,
    [vehicleId, limit],
  );
}

/* ----------------------------------------------------------------- parts -- */

export interface PartFilter {
  status?: PartStatus | "ALL" | "CURRENT" | "HISTORY";
  category?: PartCategory;
  search?: string;
  modificationsOnly?: boolean;
}

export function listParts(vehicleId: string, filter: PartFilter = {}): Promise<PartRow[]> {
  const where: string[] = ["vehicle_id = @vehicleId"];
  const args: Record<string, string | number> = { vehicleId };

  if (filter.status === "CURRENT") {
    where.push("status = 'INSTALLED'");
  } else if (filter.status === "HISTORY") {
    where.push("status <> 'INSTALLED'");
  } else if (filter.status && filter.status !== "ALL") {
    where.push("status = @status");
    args.status = filter.status;
  }

  if (filter.category) {
    where.push("category = @category");
    args.category = filter.category;
  }

  if (filter.modificationsOnly) {
    where.push("is_modification = 1");
  }

  if (filter.search) {
    // ILIKE is not available in SQLite; LIKE is already case-insensitive for
    // ASCII, and LOWER() makes that explicit for the columns we search.
    where.push(
      `(LOWER(name) LIKE @search
        OR LOWER(COALESCE(manufacturer,'')) LIKE @search
        OR LOWER(COALESCE(part_number,'')) LIKE @search
        OR LOWER(COALESCE(purchase_vendor,'')) LIKE @search
        OR LOWER(COALESCE(installer_name,'')) LIKE @search)`,
    );
    args.search = `%${filter.search.toLowerCase()}%`;
  }

  return all<PartRow>(
    `SELECT * FROM part
      WHERE ${where.join(" AND ")}
      ORDER BY (installed_on IS NULL) ASC, installed_on DESC, created_at DESC`,
    args,
  );
}

export function getPart(id: string): Promise<PartRow | null> {
  return one<PartRow>(`SELECT * FROM part WHERE id = ?`, [id]);
}

export async function countParts(
  vehicleId: string,
): Promise<{ installed: number; total: number; modifications: number }> {
  const row = await one<{ installed: number | null; total: number | null; modifications: number | null }>(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'INSTALLED' THEN 1 ELSE 0 END) AS installed,
        SUM(CASE WHEN status = 'INSTALLED' AND is_modification = 1 THEN 1 ELSE 0 END) AS modifications
      FROM part WHERE vehicle_id = ?`,
    [vehicleId],
  );

  return {
    installed: row?.installed ?? 0,
    total: row?.total ?? 0,
    modifications: row?.modifications ?? 0,
  };
}

/* ------------------------------------------------------------- schedules -- */

export function listSchedules(partId: string, activeOnly = false): Promise<ScheduleRow[]> {
  return all<ScheduleRow>(
    `SELECT * FROM maintenance_schedule
      WHERE part_id = ? AND (? = 0 OR is_active = 1)
      ORDER BY created_at ASC`,
    [partId, activeOnly ? 1 : 0],
  );
}

export function getSchedule(id: string): Promise<ScheduleRow | null> {
  return one<ScheduleRow>(`SELECT * FROM maintenance_schedule WHERE id = ?`, [id]);
}

/* -------------------------------------------------------- service records -- */

export function listServiceRecords(partId: string): Promise<ServiceRecordRow[]> {
  return all<ServiceRecordRow>(
    `SELECT * FROM service_record WHERE part_id = ? ORDER BY performed_on DESC, created_at DESC`,
    [partId],
  );
}

export function listVehicleServiceRecords(vehicleId: string): Promise<Array<ServiceRecordRow & { part_name: string }>> {
  return all<ServiceRecordRow & { part_name: string }>(
    `SELECT r.*, p.name AS part_name
       FROM service_record r
       JOIN part p ON p.id = r.part_id
      WHERE p.vehicle_id = ?
      ORDER BY r.performed_on DESC, r.created_at DESC`,
    [vehicleId],
  );
}

/* ----------------------------------------------------------- attachments -- */

export function listPartAttachments(partId: string): Promise<AttachmentRow[]> {
  return all<AttachmentRow>(`SELECT * FROM attachment WHERE part_id = ? ORDER BY created_at ASC`, [partId]);
}

export function getAttachment(id: string): Promise<AttachmentRow | null> {
  return one<AttachmentRow>(`SELECT * FROM attachment WHERE id = ?`, [id]);
}

/* ------------------------------------------------------ composed reads ---- */

export interface ScheduleWithDue {
  schedule: ScheduleRow;
  due: ScheduleDue;
}

export interface PartDetail {
  part: PartRow;
  schedules: ScheduleWithDue[];
  /** Most urgent active schedule, used for list rows and dashboard rollups. */
  topDue: ScheduleWithDue | null;
  totalCents: number | null;
}

export async function decorateParts(parts: PartRow[], usage: UsageSnapshot): Promise<PartDetail[]> {
  if (parts.length === 0) return [];

  const ids = parts.map((part) => part.id);
  const schedules = await all<ScheduleRow>(
    `SELECT * FROM maintenance_schedule WHERE part_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at ASC`,
    ids,
  );

  const byPart = new Map<string, ScheduleRow[]>();
  for (const schedule of schedules) {
    const list = byPart.get(schedule.part_id) ?? [];
    list.push(schedule);
    byPart.set(schedule.part_id, list);
  }

  return parts.map((part) => {
    const decorated = (byPart.get(part.id) ?? []).map((schedule) => ({
      schedule,
      due: evaluateSchedule(schedule, usage),
    }));

    // Only a part still on the vehicle can have live maintenance due.
    const live = isOnVehicle(part)
      ? decorated.filter((entry) => entry.schedule.is_active === 1).sort((a, b) => compareDue(a.due, b.due))
      : [];

    return {
      part,
      schedules: decorated,
      topDue: live[0] ?? null,
      totalCents: totalInstalledCents(part),
    };
  });
}

export async function getPartDetail(partId: string, usage: UsageSnapshot): Promise<PartDetail | null> {
  const part = await getPart(partId);
  if (!part) return null;
  return (await decorateParts([part], usage))[0];
}

/* ------------------------------------------------------------ build sheet -- */

export interface BuildSheetCategory {
  category: string;
  label: string;
  parts: PartDetail[];
}

export interface BuildSheetSection {
  group: CategoryGroup;
  label: string;
  icon: string;
  categories: BuildSheetCategory[];
  partCount: number;
  totalCents: number | null;
}

/**
 * Currently installed parts grouped into build-sheet sections. Modifications
 * only by default, so consumables do not clutter the build sheet.
 */
export async function buildSheet(
  vehicleId: string,
  usage: UsageSnapshot,
  modificationsOnly = true,
): Promise<BuildSheetSection[]> {
  const parts = await decorateParts(await listParts(vehicleId, { status: "CURRENT", modificationsOnly }), usage);

  const grouped = new Map<CategoryGroup, Map<string, PartDetail[]>>();
  for (const detail of parts) {
    const group = categoryGroupOf(detail.part.category);
    const categories = grouped.get(group) ?? new Map<string, PartDetail[]>();
    const list = categories.get(detail.part.category) ?? [];
    list.push(detail);
    categories.set(detail.part.category, list);
    grouped.set(group, categories);
  }

  const sections: BuildSheetSection[] = [];
  for (const group of CATEGORY_GROUP_ORDER) {
    const categories = grouped.get(group);
    if (!categories) continue;

    const entries: BuildSheetCategory[] = [...categories.entries()]
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([category, list]) => ({ category, label: categoryLabel(category), parts: list }));

    const allParts = entries.flatMap((entry) => entry.parts);
    const costs = allParts.map((detail) => detail.totalCents).filter((value): value is number => value != null);

    sections.push({
      group,
      label: CATEGORY_GROUPS[group].label,
      icon: CATEGORY_GROUPS[group].icon,
      categories: entries,
      partCount: allParts.length,
      totalCents: costs.length ? costs.reduce((total, value) => total + value, 0) : null,
    });
  }

  return sections;
}

/* --------------------------------------------------------------- history -- */

export type TimelineEvent =
  | { kind: "INSTALL"; date: string; part: PartRow }
  | { kind: "REMOVAL"; date: string; part: PartRow; replacedBy: PartRow | null }
  | { kind: "SERVICE"; date: string; part: PartRow; record: ServiceRecordRow }
  | { kind: "READING"; date: string; reading: UsageReadingRow };

/**
 * Every recorded event for a vehicle, newest first. Replaced parts keep their
 * install and removal entries, so the record stays complete.
 */
export async function vehicleTimeline(
  vehicleId: string,
  options: { includeReadings?: boolean } = {},
): Promise<TimelineEvent[]> {
  const [parts, services, readings] = await Promise.all([
    listParts(vehicleId),
    listVehicleServiceRecords(vehicleId),
    options.includeReadings ? listUsageReadings(vehicleId, 200) : Promise.resolve([]),
  ]);

  const partsById = new Map(parts.map((part) => [part.id, part]));
  const successorOf = new Map<string, PartRow>();
  for (const part of parts) {
    if (part.replaces_part_id) successorOf.set(part.replaces_part_id, part);
  }

  const events: TimelineEvent[] = [];

  for (const part of parts) {
    if (part.installed_on) events.push({ kind: "INSTALL", date: part.installed_on, part });
    if (part.removed_on) {
      events.push({ kind: "REMOVAL", date: part.removed_on, part, replacedBy: successorOf.get(part.id) ?? null });
    }
  }

  for (const record of services) {
    const part = partsById.get(record.part_id);
    if (part) events.push({ kind: "SERVICE", date: record.performed_on, part, record });
  }

  for (const reading of readings) {
    events.push({ kind: "READING", date: reading.recorded_on, reading });
  }

  const order: Record<TimelineEvent["kind"], number> = { INSTALL: 0, REMOVAL: 1, SERVICE: 2, READING: 3 };
  return events.sort((a, b) => (a.date === b.date ? order[a.kind] - order[b.kind] : a.date < b.date ? 1 : -1));
}

/** The full replacement chain a part belongs to, oldest first. */
export async function partLineage(part: PartRow): Promise<PartRow[]> {
  const chain: PartRow[] = [part];

  let cursor = part;
  while (cursor.replaces_part_id) {
    const previous = await getPart(cursor.replaces_part_id);
    if (!previous || chain.some((entry) => entry.id === previous.id)) break;
    chain.unshift(previous);
    cursor = previous;
  }

  cursor = part;
  for (;;) {
    const next = await one<PartRow>(
      `SELECT * FROM part WHERE replaces_part_id = ? ORDER BY created_at ASC LIMIT 1`,
      [cursor.id],
    );
    if (!next || chain.some((entry) => entry.id === next.id)) break;
    chain.push(next);
    cursor = next;
  }

  return chain;
}

/* ------------------------------------------------------------ roll-ups ---- */

export interface VehicleCostSummary {
  modificationCents: number;
  maintenanceCents: number;
  partsCents: number;
  laborCents: number;
  serviceCents: number;
  totalCents: number;
}

export async function vehicleCostSummary(vehicleId: string): Promise<VehicleCostSummary> {
  const [parts, service] = await Promise.all([
    one<{
      modification_cents: number | null;
      maintenance_cents: number | null;
      parts_cents: number | null;
      labor_cents: number | null;
    }>(
      `SELECT
          SUM(CASE WHEN is_modification = 1 THEN ${COST_SUM} ELSE 0 END) AS modification_cents,
          SUM(CASE WHEN is_modification = 0 THEN ${COST_SUM} ELSE 0 END) AS maintenance_cents,
          SUM(COALESCE(part_cost_cents,0) + COALESCE(shipping_cost_cents,0) + COALESCE(tax_cents,0)) AS parts_cents,
          SUM(COALESCE(labor_cost_cents,0)) AS labor_cents
        FROM part WHERE vehicle_id = ?`,
      [vehicleId],
    ),
    one<{ total: number | null }>(
      `SELECT SUM(r.cost_cents) AS total FROM service_record r
         JOIN part p ON p.id = r.part_id
        WHERE p.vehicle_id = ?`,
      [vehicleId],
    ),
  ]);

  const summary: VehicleCostSummary = {
    modificationCents: parts?.modification_cents ?? 0,
    maintenanceCents: parts?.maintenance_cents ?? 0,
    partsCents: parts?.parts_cents ?? 0,
    laborCents: parts?.labor_cents ?? 0,
    serviceCents: service?.total ?? 0,
    totalCents: 0,
  };

  summary.totalCents = summary.modificationCents + summary.maintenanceCents + summary.serviceCents;
  return summary;
}

export interface AttentionItem {
  vehicle: VehicleRow;
  part: PartRow;
  schedule: ScheduleRow;
  due: ScheduleDue;
}

/**
 * Active schedules across every vehicle, most urgent first.
 *
 * Deliberately three queries regardless of how many vehicles there are: with a
 * hosted database each round-trip costs real latency, and this powers the
 * dashboard.
 */
export async function attentionItems(
  options: { vehicleId?: string; levels?: ScheduleDue["level"][] } = {},
): Promise<AttentionItem[]> {
  const vehicles = options.vehicleId
    ? ([await getVehicle(options.vehicleId)].filter((vehicle): vehicle is VehicleRow => vehicle != null))
    : await listVehicles();

  if (vehicles.length === 0) return [];

  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const placeholders = vehicleIds.map(() => "?").join(",");

  const schedules = await all<ScheduleRow & { vehicle_id: string }>(
    `SELECT s.*, p.vehicle_id AS vehicle_id
       FROM maintenance_schedule s
       JOIN part p ON p.id = s.part_id
      WHERE p.vehicle_id IN (${placeholders})
        AND s.is_active = 1
        AND p.status = 'INSTALLED'`,
    vehicleIds,
  );

  if (schedules.length === 0) return [];

  const partIds = [...new Set(schedules.map((schedule) => schedule.part_id))];
  const parts = await all<PartRow>(
    `SELECT * FROM part WHERE id IN (${partIds.map(() => "?").join(",")})`,
    partIds,
  );

  const partsById = new Map(parts.map((part) => [part.id, part]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const usageByVehicle = new Map(vehicles.map((vehicle) => [vehicle.id, getUsage(vehicle)]));

  const items: AttentionItem[] = [];
  for (const schedule of schedules) {
    const part = partsById.get(schedule.part_id);
    const vehicle = vehiclesById.get(schedule.vehicle_id);
    const usage = usageByVehicle.get(schedule.vehicle_id);
    if (!part || !vehicle || !usage) continue;

    const due = evaluateSchedule(schedule, usage);
    if (options.levels && !options.levels.includes(due.level)) continue;
    items.push({ vehicle, part, schedule, due });
  }

  return items.sort((a, b) => compareDue(a.due, b.due));
}

export async function recentlyInstalled(limit = 8): Promise<Array<{ vehicle: VehicleRow; part: PartRow }>> {
  const [parts, vehicles] = await Promise.all([
    all<PartRow>(
      `SELECT p.* FROM part p
         JOIN vehicle v ON v.id = p.vehicle_id
        WHERE v.archived = 0 AND p.installed_on IS NOT NULL
        ORDER BY p.installed_on DESC, p.created_at DESC
        LIMIT ?`,
      [limit],
    ),
    listVehicles(true),
  ]);

  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return parts
    .map((part) => ({ part, vehicle: vehiclesById.get(part.vehicle_id) }))
    .filter((entry): entry is { part: PartRow; vehicle: VehicleRow } => entry.vehicle != null);
}

export interface FleetStats {
  vehicles: number;
  installedParts: number;
  totalParts: number;
  modificationCents: number;
  totalSpendCents: number;
  overdue: number;
  dueSoon: number;
}

/** Fleet-wide totals in two aggregate queries plus the attention scan. */
export async function fleetStats(): Promise<FleetStats> {
  const [totals, serviceTotal, attention] = await Promise.all([
    one<{
      vehicles: number | null;
      total_parts: number | null;
      installed_parts: number | null;
      modification_cents: number | null;
      all_cents: number | null;
    }>(
      `SELECT
          (SELECT COUNT(*) FROM vehicle WHERE archived = 0) AS vehicles,
          COUNT(p.id) AS total_parts,
          SUM(CASE WHEN p.status = 'INSTALLED' THEN 1 ELSE 0 END) AS installed_parts,
          SUM(CASE WHEN p.is_modification = 1 THEN ${COST_SUM} ELSE 0 END) AS modification_cents,
          SUM(${COST_SUM}) AS all_cents
        FROM part p
        JOIN vehicle v ON v.id = p.vehicle_id
       WHERE v.archived = 0`,
    ),
    one<{ total: number | null }>(
      `SELECT SUM(r.cost_cents) AS total
         FROM service_record r
         JOIN part p ON p.id = r.part_id
         JOIN vehicle v ON v.id = p.vehicle_id
        WHERE v.archived = 0`,
    ),
    attentionItems(),
  ]);

  const stats: FleetStats = {
    vehicles: totals?.vehicles ?? 0,
    installedParts: totals?.installed_parts ?? 0,
    totalParts: totals?.total_parts ?? 0,
    modificationCents: totals?.modification_cents ?? 0,
    totalSpendCents: (totals?.all_cents ?? 0) + (serviceTotal?.total ?? 0),
    overdue: 0,
    dueSoon: 0,
  };

  for (const item of attention) {
    if (item.due.level === "OVERDUE" || item.due.level === "DUE") stats.overdue += 1;
    else if (item.due.level === "DUE_SOON") stats.dueSoon += 1;
  }

  return stats;
}
