import "server-only";

import { db } from "./db";
import { todayIso } from "./dates";
import {
  CATEGORY_GROUPS,
  CATEGORY_GROUP_ORDER,
  categoryGroupOf,
  categoryLabel,
  PART_CATEGORIES,
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

/* -------------------------------------------------------------- vehicles -- */

export function listVehicles(includeArchived = false): VehicleRow[] {
  return db
    .prepare<[number], VehicleRow>(
      `SELECT * FROM vehicle
        WHERE (? = 1 OR archived = 0)
        ORDER BY archived ASC, year DESC, make ASC, model ASC`,
    )
    .all(includeArchived ? 1 : 0);
}

export function getVehicle(id: string): VehicleRow | null {
  return db.prepare<[string], VehicleRow>(`SELECT * FROM vehicle WHERE id = ?`).get(id) ?? null;
}

export function getUsage(vehicle: VehicleRow): UsageSnapshot {
  return usageOf(vehicle, todayIso());
}

export function listUsageReadings(vehicleId: string, limit = 50): UsageReadingRow[] {
  return db
    .prepare<[string, number], UsageReadingRow>(
      `SELECT * FROM usage_reading WHERE vehicle_id = ? ORDER BY recorded_on DESC, created_at DESC LIMIT ?`,
    )
    .all(vehicleId, limit);
}

/* ----------------------------------------------------------------- parts -- */

export interface PartFilter {
  status?: PartStatus | "ALL" | "CURRENT" | "HISTORY";
  category?: PartCategory;
  search?: string;
  modificationsOnly?: boolean;
}

export function listParts(vehicleId: string, filter: PartFilter = {}): PartRow[] {
  const where: string[] = ["vehicle_id = @vehicleId"];
  const params: Record<string, unknown> = { vehicleId };

  if (filter.status === "CURRENT") {
    where.push("status = 'INSTALLED'");
  } else if (filter.status === "HISTORY") {
    where.push("status <> 'INSTALLED'");
  } else if (filter.status && filter.status !== "ALL") {
    where.push("status = @status");
    params.status = filter.status;
  }

  if (filter.category) {
    where.push("category = @category");
    params.category = filter.category;
  }

  if (filter.modificationsOnly) {
    where.push("is_modification = 1");
  }

  if (filter.search) {
    where.push(
      `(name LIKE @search COLLATE NOCASE
        OR manufacturer LIKE @search COLLATE NOCASE
        OR part_number LIKE @search COLLATE NOCASE
        OR purchase_vendor LIKE @search COLLATE NOCASE
        OR installer_name LIKE @search COLLATE NOCASE)`,
    );
    params.search = `%${filter.search}%`;
  }

  return db
    .prepare<Record<string, unknown>, PartRow>(
      `SELECT * FROM part
        WHERE ${where.join(" AND ")}
        ORDER BY (installed_on IS NULL) ASC, installed_on DESC, created_at DESC`,
    )
    .all(params);
}

export function getPart(id: string): PartRow | null {
  return db.prepare<[string], PartRow>(`SELECT * FROM part WHERE id = ?`).get(id) ?? null;
}

export function countParts(vehicleId: string): { installed: number; total: number; modifications: number } {
  const row = db
    .prepare<[string], { installed: number; total: number; modifications: number }>(
      `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'INSTALLED' THEN 1 ELSE 0 END) AS installed,
          SUM(CASE WHEN status = 'INSTALLED' AND is_modification = 1 THEN 1 ELSE 0 END) AS modifications
        FROM part WHERE vehicle_id = ?`,
    )
    .get(vehicleId);
  return { installed: row?.installed ?? 0, total: row?.total ?? 0, modifications: row?.modifications ?? 0 };
}

/* ------------------------------------------------------------- schedules -- */

export function listSchedules(partId: string, activeOnly = false): ScheduleRow[] {
  return db
    .prepare<[string, number], ScheduleRow>(
      `SELECT * FROM maintenance_schedule
        WHERE part_id = ? AND (? = 0 OR is_active = 1)
        ORDER BY created_at ASC`,
    )
    .all(partId, activeOnly ? 1 : 0);
}

export function getSchedule(id: string): ScheduleRow | null {
  return db.prepare<[string], ScheduleRow>(`SELECT * FROM maintenance_schedule WHERE id = ?`).get(id) ?? null;
}

/** Active schedules for parts still fitted to the vehicle. */
export function listVehicleSchedules(vehicleId: string): Array<{ part: PartRow; schedule: ScheduleRow }> {
  const rows = db
    .prepare<[string], ScheduleRow & { __part: string }>(
      `SELECT s.* FROM maintenance_schedule s
         JOIN part p ON p.id = s.part_id
        WHERE p.vehicle_id = ? AND s.is_active = 1 AND p.status = 'INSTALLED'`,
    )
    .all(vehicleId);

  const parts = new Map(listParts(vehicleId).map((part) => [part.id, part]));
  return rows
    .map((schedule) => ({ schedule, part: parts.get(schedule.part_id)! }))
    .filter((entry) => entry.part != null);
}

/* -------------------------------------------------------- service records -- */

export function listServiceRecords(partId: string): ServiceRecordRow[] {
  return db
    .prepare<[string], ServiceRecordRow>(
      `SELECT * FROM service_record WHERE part_id = ? ORDER BY performed_on DESC, created_at DESC`,
    )
    .all(partId);
}

export function listVehicleServiceRecords(vehicleId: string): Array<ServiceRecordRow & { part_name: string }> {
  return db
    .prepare<[string], ServiceRecordRow & { part_name: string }>(
      `SELECT r.*, p.name AS part_name
         FROM service_record r
         JOIN part p ON p.id = r.part_id
        WHERE p.vehicle_id = ?
        ORDER BY r.performed_on DESC, r.created_at DESC`,
    )
    .all(vehicleId);
}

/* ----------------------------------------------------------- attachments -- */

export function listPartAttachments(partId: string): AttachmentRow[] {
  return db
    .prepare<[string], AttachmentRow>(
      `SELECT * FROM attachment WHERE part_id = ? ORDER BY created_at ASC`,
    )
    .all(partId);
}

export function getAttachment(id: string): AttachmentRow | null {
  return db.prepare<[string], AttachmentRow>(`SELECT * FROM attachment WHERE id = ?`).get(id) ?? null;
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

export function decorateParts(parts: PartRow[], usage: UsageSnapshot): PartDetail[] {
  if (parts.length === 0) return [];

  const placeholders = parts.map(() => "?").join(",");
  const schedules = db
    .prepare<string[], ScheduleRow>(
      `SELECT * FROM maintenance_schedule WHERE part_id IN (${placeholders}) ORDER BY created_at ASC`,
    )
    .all(...parts.map((part) => part.id));

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

export function getPartDetail(partId: string, usage: UsageSnapshot): PartDetail | null {
  const part = getPart(partId);
  if (!part) return null;
  return decorateParts([part], usage)[0];
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
export function buildSheet(vehicleId: string, usage: UsageSnapshot, modificationsOnly = true): BuildSheetSection[] {
  const parts = decorateParts(
    listParts(vehicleId, { status: "CURRENT", modificationsOnly }),
    usage,
  );

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

    const all = entries.flatMap((entry) => entry.parts);
    const costs = all.map((detail) => detail.totalCents).filter((value): value is number => value != null);

    sections.push({
      group,
      label: CATEGORY_GROUPS[group].label,
      icon: CATEGORY_GROUPS[group].icon,
      categories: entries,
      partCount: all.length,
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
export function vehicleTimeline(vehicleId: string, options: { includeReadings?: boolean } = {}): TimelineEvent[] {
  const parts = listParts(vehicleId);
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

  for (const record of listVehicleServiceRecords(vehicleId)) {
    const part = partsById.get(record.part_id);
    if (part) events.push({ kind: "SERVICE", date: record.performed_on, part, record });
  }

  if (options.includeReadings) {
    for (const reading of listUsageReadings(vehicleId, 200)) {
      events.push({ kind: "READING", date: reading.recorded_on, reading });
    }
  }

  const order: Record<TimelineEvent["kind"], number> = { INSTALL: 0, REMOVAL: 1, SERVICE: 2, READING: 3 };
  return events.sort((a, b) => (a.date === b.date ? order[a.kind] - order[b.kind] : a.date < b.date ? 1 : -1));
}

/** The full replacement chain a part belongs to, oldest first. */
export function partLineage(part: PartRow): PartRow[] {
  const chain: PartRow[] = [part];

  let cursor = part;
  while (cursor.replaces_part_id) {
    const previous = getPart(cursor.replaces_part_id);
    if (!previous || chain.some((entry) => entry.id === previous.id)) break;
    chain.unshift(previous);
    cursor = previous;
  }

  cursor = part;
  for (;;) {
    const next = db
      .prepare<[string], PartRow>(`SELECT * FROM part WHERE replaces_part_id = ? ORDER BY created_at ASC LIMIT 1`)
      .get(cursor.id);
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

export function vehicleCostSummary(vehicleId: string): VehicleCostSummary {
  const parts = listParts(vehicleId);
  const summary: VehicleCostSummary = {
    modificationCents: 0,
    maintenanceCents: 0,
    partsCents: 0,
    laborCents: 0,
    serviceCents: 0,
    totalCents: 0,
  };

  for (const part of parts) {
    const total = totalInstalledCents(part) ?? 0;
    summary.partsCents += (part.part_cost_cents ?? 0) + (part.shipping_cost_cents ?? 0) + (part.tax_cents ?? 0);
    summary.laborCents += part.labor_cost_cents ?? 0;
    if (part.is_modification) summary.modificationCents += total;
    else summary.maintenanceCents += total;
  }

  const service = db
    .prepare<[string], { total: number | null }>(
      `SELECT SUM(r.cost_cents) AS total FROM service_record r
         JOIN part p ON p.id = r.part_id
        WHERE p.vehicle_id = ?`,
    )
    .get(vehicleId);

  summary.serviceCents = service?.total ?? 0;
  summary.totalCents = summary.modificationCents + summary.maintenanceCents + summary.serviceCents;
  return summary;
}

export interface AttentionItem {
  vehicle: VehicleRow;
  part: PartRow;
  schedule: ScheduleRow;
  due: ScheduleDue;
}

/** Active schedules across every vehicle, most urgent first. */
export function attentionItems(options: { vehicleId?: string; levels?: ScheduleDue["level"][] } = {}): AttentionItem[] {
  const vehicles = options.vehicleId
    ? [getVehicle(options.vehicleId)].filter((vehicle): vehicle is VehicleRow => vehicle != null)
    : listVehicles();

  const items: AttentionItem[] = [];
  for (const vehicle of vehicles) {
    const usage = getUsage(vehicle);
    for (const { part, schedule } of listVehicleSchedules(vehicle.id)) {
      const due = evaluateSchedule(schedule, usage);
      if (options.levels && !options.levels.includes(due.level)) continue;
      items.push({ vehicle, part, schedule, due });
    }
  }

  return items.sort((a, b) => compareDue(a.due, b.due));
}

export function recentlyInstalled(limit = 8): Array<{ vehicle: VehicleRow; part: PartRow }> {
  const parts = db
    .prepare<[number], PartRow>(
      `SELECT p.* FROM part p
         JOIN vehicle v ON v.id = p.vehicle_id
        WHERE v.archived = 0 AND p.installed_on IS NOT NULL
        ORDER BY p.installed_on DESC, p.created_at DESC
        LIMIT ?`,
    )
    .all(limit);

  const vehicles = new Map(listVehicles(true).map((vehicle) => [vehicle.id, vehicle]));
  return parts
    .map((part) => ({ part, vehicle: vehicles.get(part.vehicle_id)! }))
    .filter((entry) => entry.vehicle != null);
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

export function fleetStats(): FleetStats {
  const vehicles = listVehicles();
  const stats: FleetStats = {
    vehicles: vehicles.length,
    installedParts: 0,
    totalParts: 0,
    modificationCents: 0,
    totalSpendCents: 0,
    overdue: 0,
    dueSoon: 0,
  };

  for (const vehicle of vehicles) {
    const counts = countParts(vehicle.id);
    stats.installedParts += counts.installed;
    stats.totalParts += counts.total;

    const costs = vehicleCostSummary(vehicle.id);
    stats.modificationCents += costs.modificationCents;
    stats.totalSpendCents += costs.totalCents;
  }

  for (const item of attentionItems()) {
    if (item.due.level === "OVERDUE" || item.due.level === "DUE") stats.overdue += 1;
    else if (item.due.level === "DUE_SOON") stats.dueSoon += 1;
  }

  return stats;
}

export const CATEGORY_LABELS = PART_CATEGORIES;
