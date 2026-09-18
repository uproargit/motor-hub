/**
 * Loads a demo fleet so the app can be explored with realistic data.
 *
 *   node scripts/seed.mjs          # refuses if the database already has data
 *   node scripts/seed.mjs --reset  # wipes and reloads
 *
 * Dates are anchored to today so the dashboard always shows a useful mix of
 * overdue, due-soon and healthy items.
 */

import { createClient } from "@libsql/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { splitStatements } from "../src/lib/sql-file.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = process.env.MOTOR_HUB_DATA_DIR ?? path.join(ROOT, "data");
const RESET = process.argv.includes("--reset");

fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? `file:${path.join(DATA_DIR, "motor-hub.db")}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

/** Runs a statement and returns the rows. */
async function sql(statement, args) {
  const result = await db.execute(args === undefined ? statement : { sql: statement, args });
  return result.rows;
}

const schema = fs.readFileSync(path.join(ROOT, "src/lib/schema.sql"), "utf8");
for (const statement of splitStatements(schema)) {
  await db.execute(statement);
}

const existing = Number((await sql("SELECT COUNT(*) AS n FROM vehicle"))[0].n);
if (existing > 0 && !RESET) {
  console.log(`Database already has ${existing} vehicle(s). Re-run with --reset to replace them.`);
  process.exit(0);
}
if (RESET) {
  for (const table of ["attachment", "service_record", "maintenance_schedule", "part", "usage_reading", "vehicle"]) {
    await db.execute(`DELETE FROM ${table}`);
  }
}

/* ------------------------------------------------------------- helpers ---- */

const now = new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
const today = new Date().toISOString().slice(0, 10);

const addDays = (iso, days) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

function addMonths(iso, months) {
  const date = new Date(`${iso}T00:00:00Z`);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}

const cents = (dollars) => (dollars == null ? null : Math.round(dollars * 100));

async function insertVehicle(vehicle) {
  const row = {
    id: id("veh"),
    nickname: null,
    year: null,
    trim: null,
    vin: null,
    plate: null,
    color: null,
    purchased_on: null,
    purchase_price_cents: null,
    tracks_mileage: 1,
    tracks_engine_hours: 0,
    current_mileage: null,
    current_engine_hours: null,
    usage_updated_on: today,
    notes: null,
    archived: 0,
    created_at: now,
    updated_at: now,
    ...vehicle,
  };

  const columns = Object.keys(row);
  await sql(
    `INSERT INTO vehicle (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`,
    row,
  );

  await sql(
    `INSERT INTO usage_reading (id, vehicle_id, recorded_on, mileage, engine_hours, source, notes, created_at)
     VALUES (?, ?, ?, ?, ?, 'MANUAL', NULL, ?)`,
    [id("usg"), row.id, today, row.current_mileage, row.current_engine_hours, now],
  );

  return row.id;
}

async function insertPart(vehicleId, part) {
  const row = {
    id: id("prt"),
    vehicle_id: vehicleId,
    category: "OTHER",
    manufacturer: null,
    part_number: null,
    description: null,
    quantity: 1,
    is_modification: 1,
    is_oem: 0,
    status: "INSTALLED",
    installed_on: null,
    installed_mileage: null,
    installed_hours: null,
    installed_by: "SELF",
    installer_name: null,
    installer_phone: null,
    installer_email: null,
    installer_address: null,
    install_notes: null,
    part_cost_cents: null,
    labor_cost_cents: null,
    shipping_cost_cents: null,
    tax_cents: null,
    purchase_vendor: null,
    purchase_location: null,
    purchased_on: null,
    order_number: null,
    warranty_type: "NONE",
    warranty_provider: null,
    warranty_months: null,
    warranty_miles: null,
    warranty_hours: null,
    warranty_expires_on: null,
    warranty_notes: null,
    removed_on: null,
    removed_mileage: null,
    removed_hours: null,
    removal_reason: null,
    disposition: null,
    sale_price_cents: null,
    replaces_part_id: null,
    notes: null,
    created_at: now,
    updated_at: now,
    ...part,
  };

  const columns = Object.keys(row);
  await sql(
    `INSERT INTO part (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`,
    row,
  );

  return row.id;
}

async function insertSchedule(partId, schedule) {
  const row = {
    id: id("sch"),
    part_id: partId,
    task_type: "INSPECT",
    label: null,
    interval_miles: null,
    interval_hours: null,
    interval_months: null,
    trigger_mode: "FIRST",
    base_mileage: null,
    base_hours: null,
    base_on: null,
    is_active: 1,
    notes: null,
    created_at: now,
    updated_at: now,
    ...schedule,
  };

  const columns = Object.keys(row);
  await sql(
    `INSERT INTO maintenance_schedule (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`,
    row,
  );

  return row.id;
}

async function insertService(partId, service) {
  const row = {
    id: id("svc"),
    part_id: partId,
    schedule_id: null,
    task_type: "SERVICE",
    performed_on: today,
    mileage: null,
    engine_hours: null,
    performed_by: "SELF",
    performer_name: null,
    cost_cents: null,
    outcome: null,
    notes: null,
    created_at: now,
    ...service,
  };

  const columns = Object.keys(row);
  await sql(
    `INSERT INTO service_record (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`,
    row,
  );

  return row.id;
}

/* ------------------------------------------------------ 1. Polaris RZR ---- */
// Engine-hour machine: the drive belt is 6 hours from its inspection.

const rzr = await insertVehicle({
  year: 2024,
  make: "Polaris",
  model: "RZR",
  trim: "Pro R",
  vehicle_type: "UTV",
  color: "Matte Sage",
  tracks_mileage: 1,
  tracks_engine_hours: 1,
  current_mileage: 742,
  current_engine_hours: 116,
  purchased_on: addMonths(today, -14),
  purchase_price_cents: cents(38_999),
  notes: "Desert build. Ridden mostly at Glamis and Johnson Valley.",
});

const wheels = await insertPart(rzr, {
  name: "Method 401 Beadlock Wheels",
  category: "WHEELS",
  manufacturer: "Method Race Wheels",
  part_number: "MR40157047344",
  description: '15x7 beadlock wheels, 4+3 offset, matte black with red rings.',
  quantity: 4,
  installed_on: addMonths(today, -6),
  installed_hours: 42,
  installed_mileage: 280,
  installed_by: "SHOP",
  installer_name: "Desert Performance Garage",
  installer_phone: "(760) 555-0142",
  part_cost_cents: cents(1_396),
  labor_cost_cents: cents(240),
  tax_cents: cents(108.9),
  purchase_vendor: "Rocky Mountain ATV/MC",
  purchased_on: addMonths(today, -7),
  order_number: "RM-884213",
  warranty_type: "MANUFACTURER",
  warranty_provider: "Method Race Wheels",
  warranty_months: 12,
  notes: "Beadlock rings torqued to 15 ft-lb in a star pattern.",
});
await insertSchedule(wheels, {
  task_type: "TORQUE",
  label: "Re-torque beadlock rings",
  interval_hours: 100,
  base_hours: 42,
  base_on: addMonths(today, -6),
});

await insertPart(rzr, {
  name: "Maxxis Roxxzilla Tires",
  category: "TIRES",
  manufacturer: "Maxxis",
  part_number: "TM00050100",
  description: "32x10R15 competition compound.",
  quantity: 4,
  installed_on: addMonths(today, -6),
  installed_hours: 42,
  installed_mileage: 280,
  installed_by: "SHOP",
  installer_name: "Desert Performance Garage",
  part_cost_cents: cents(1_240),
  labor_cost_cents: cents(160),
});

await insertPart(rzr, {
  name: "Shock Therapy Stage 4 Suspension",
  category: "SUSPENSION",
  manufacturer: "Shock Therapy",
  part_number: "ST-RZRPRO-S4",
  description: "Full Stage 4 valving and spring package with dual-rate springs.",
  installed_on: addMonths(today, -9),
  installed_hours: 18,
  installed_by: "SHOP",
  installer_name: "Shock Therapy",
  installer_address: "Wittmann, AZ",
  part_cost_cents: cents(2_895),
  labor_cost_cents: cents(750),
  warranty_type: "LIMITED",
  warranty_provider: "Shock Therapy",
  warranty_months: 24,
});

await insertPart(rzr, {
  name: "Rigid Industries 30in Adapt Light Bar",
  category: "LIGHTING",
  manufacturer: "Rigid Industries",
  part_number: "280413",
  installed_on: addMonths(today, -8),
  installed_hours: 26,
  part_cost_cents: cents(1_299.99),
  purchase_vendor: "Rigid Industries",
  warranty_type: "LIFETIME",
  warranty_provider: "Rigid Industries",
  warranty_notes: "Lifetime warranty on LED and housing, 2 years on wiring harness.",
});

await insertPart(rzr, {
  name: "Aftermarket ECU Tune",
  category: "TUNING",
  manufacturer: "Cryo Heat",
  description: "93 octane calibration, rev limiter raised, speed limiter removed.",
  installed_on: addMonths(today, -5),
  installed_hours: 58,
  installed_by: "SHOP",
  installer_name: "Cryo Heat",
  part_cost_cents: cents(799),
});

await insertPart(rzr, {
  name: "Performance Exhaust",
  category: "EXHAUST",
  manufacturer: "HMF Racing",
  part_number: "HMF-RZRPRO-TI",
  description: "Titanium slip-on with spark arrestor.",
  installed_on: addMonths(today, -5),
  installed_hours: 58,
  part_cost_cents: cents(949),
  labor_cost_cents: cents(0),
});

// The dashboard's warning item: 6 engine hours from its next inspection.
const belt = await insertPart(rzr, {
  name: "Drive Belt",
  category: "CONSUMABLES",
  manufacturer: "Polaris",
  part_number: "3211202",
  is_modification: 0,
  is_oem: 1,
  installed_on: addMonths(today, -3),
  installed_hours: 72,
  installed_mileage: 480,
  part_cost_cents: cents(189.99),
  notes: "Carry a spare belt and the clutch tool on every trip.",
});
await insertSchedule(belt, {
  task_type: "INSPECT",
  label: "Inspect belt and clutch sheaves",
  interval_hours: 50,
  base_hours: 72,
  base_on: addMonths(today, -3),
});

const rzrFilter = await insertPart(rzr, {
  name: "High-Flow Air Filter",
  category: "FILTERS",
  manufacturer: "K&N",
  part_number: "PL-1014",
  is_modification: 0,
  installed_on: addMonths(today, -6),
  installed_hours: 42,
  part_cost_cents: cents(89.99),
});
const rzrFilterSchedule = await insertSchedule(rzrFilter, {
  task_type: "CLEAN",
  label: "Clean and re-oil filter",
  interval_hours: 25,
  base_hours: 95,
  base_on: addMonths(today, -1),
});
await insertService(rzrFilter, {
  schedule_id: rzrFilterSchedule,
  task_type: "CLEAN",
  performed_on: addMonths(today, -1),
  engine_hours: 95,
  outcome: "Cleaned and re-oiled",
  cost_cents: cents(0),
});

/* ---------------------------------------------------------- 2. Audi S5 ---- */
// Mileage machine, and home of the battery replacement chain.

const audi = await insertVehicle({
  year: 2018,
  make: "Audi",
  model: "S5",
  trim: "Prestige",
  vehicle_type: "CAR",
  color: "Navarra Blue",
  vin: "WAUB4CF57JA012345",
  plate: "8XYZ221",
  tracks_mileage: 1,
  tracks_engine_hours: 0,
  current_mileage: 18_242,
  purchased_on: addMonths(today, -30),
  purchase_price_cents: cents(41_500),
});

// Original battery: kept forever, closed out when it failed.
const oemBattery = await insertPart(audi, {
  name: "OEM Battery",
  category: "ELECTRICAL",
  manufacturer: "Audi",
  part_number: "8W0-915-105-A",
  is_modification: 0,
  is_oem: 1,
  status: "REPLACED",
  installed_on: null,
  installed_by: "FACTORY",
  install_notes: "Fitted at the factory — original to the car.",
  removed_on: addMonths(today, -3),
  removed_mileage: 18_242,
  removal_reason: "Failed",
  disposition: "SCRAPPED",
  notes: "Failed to hold a charge after sitting for two weeks.",
});

const odyssey = await insertPart(audi, {
  name: "Odyssey Extreme Battery",
  category: "ELECTRICAL",
  manufacturer: "Odyssey",
  part_number: "ODX-AGM49",
  description: "AGM, 950 CCA, group 49.",
  is_modification: 0,
  status: "INSTALLED",
  installed_on: addMonths(today, -3),
  installed_mileage: 18_242,
  installed_by: "SELF",
  part_cost_cents: cents(289),
  purchase_vendor: "Batteries Plus",
  purchased_on: addMonths(today, -3),
  warranty_type: "LIMITED",
  warranty_provider: "Odyssey",
  warranty_months: 48,
  warranty_notes: "4 year full replacement warranty. Keep the receipt.",
  replaces_part_id: oemBattery,
});
await insertSchedule(odyssey, {
  task_type: "INSPECT",
  label: "Load test and clean terminals",
  interval_months: 12,
  base_on: addMonths(today, -3),
});

const tires = await insertPart(audi, {
  name: "Michelin Pilot Sport 4S Tires",
  category: "TIRES",
  manufacturer: "Michelin",
  part_number: "255/35ZR19",
  quantity: 4,
  installed_on: addMonths(today, -20),
  installed_mileage: 4_300,
  installed_by: "SHOP",
  installer_name: "Discount Tire",
  part_cost_cents: cents(1_284),
  labor_cost_cents: cents(160),
  tax_cents: cents(99.51),
});
await insertSchedule(tires, {
  task_type: "REPLACE",
  label: "Replace at wear limit",
  interval_miles: 15_000,
  base_mileage: 4_300,
  base_on: addMonths(today, -20),
});
await insertSchedule(tires, {
  task_type: "ROTATE",
  label: "Rotate front to rear",
  interval_miles: 6_000,
  interval_months: 6,
  base_mileage: 16_000,
  base_on: addMonths(today, -4),
});

const audiFilter = await insertPart(audi, {
  name: "K&N Air Filter",
  category: "FILTERS",
  manufacturer: "K&N",
  part_number: "33-3005",
  is_modification: 0,
  installed_on: addMonths(today, -26),
  installed_mileage: 2_400,
  part_cost_cents: cents(74.99),
});
const audiFilterSchedule = await insertSchedule(audiFilter, {
  task_type: "CLEAN",
  label: "Clean and re-oil filter",
  interval_miles: 5_000,
  base_mileage: 17_400,
  base_on: addMonths(today, -2),
});
for (const [months, mileage] of [
  [20, 7_400],
  [11, 12_400],
  [2, 17_400],
]) {
  await insertService(audiFilter, {
    schedule_id: audiFilterSchedule,
    task_type: "CLEAN",
    performed_on: addMonths(today, -months),
    mileage,
    outcome: "Cleaned and re-oiled",
  });
}

await insertPart(audi, {
  name: "APR Stage 1 ECU Tune",
  category: "TUNING",
  manufacturer: "APR",
  description: "91 octane calibration. 420 hp / 442 lb-ft.",
  installed_on: addMonths(today, -18),
  installed_mileage: 6_100,
  installed_by: "DEALER",
  installer_name: "APR Performance Center",
  part_cost_cents: cents(1_099),
  warranty_type: "MANUFACTURER",
  warranty_provider: "APR",
  warranty_months: 24,
  warranty_miles: 24_000,
});

await insertPart(audi, {
  name: "Milltek Cat-Back Exhaust",
  category: "EXHAUST",
  manufacturer: "Milltek Sport",
  part_number: "SSXAU640",
  description: "Non-resonated, cerakote black tips.",
  installed_on: addMonths(today, -17),
  installed_mileage: 6_800,
  installed_by: "SHOP",
  installer_name: "Eurotech Motorsport",
  part_cost_cents: cents(1_850),
  labor_cost_cents: cents(420),
  warranty_type: "LIFETIME",
  warranty_provider: "Milltek Sport",
});

await insertPart(audi, {
  name: "Girodisc 2-Piece Front Rotors",
  category: "BRAKES",
  manufacturer: "Girodisc",
  part_number: "A1-206",
  installed_on: addMonths(today, -9),
  installed_mileage: 13_900,
  installed_by: "SHOP",
  installer_name: "Eurotech Motorsport",
  part_cost_cents: cents(1_395),
  labor_cost_cents: cents(380),
});

/* -------------------------------------------------------------- 3. Boat --- */
// Calendar-driven machine: the impeller is overdue by 18 days.

const boat = await insertVehicle({
  nickname: "Knot Working",
  year: 2019,
  make: "Yamaha",
  model: "242X",
  trim: "Limited S",
  vehicle_type: "BOAT",
  vin: "YAMA2429K819",
  tracks_mileage: 0,
  tracks_engine_hours: 1,
  current_engine_hours: 212,
  purchased_on: addMonths(today, -40),
  purchase_price_cents: cents(64_000),
  notes: "Trailered, stored covered. Flushed after every saltwater run.",
});

const impeller = await insertPart(boat, {
  name: "Jet Pump Impeller",
  category: "DRIVETRAIN",
  manufacturer: "Solas",
  part_number: "YQ-CD-13/18",
  is_modification: 0,
  installed_on: addDays(addMonths(today, -12), -18),
  installed_hours: 150,
  installed_by: "DEALER",
  installer_name: "Lakeside Marine",
  part_cost_cents: cents(389),
  labor_cost_cents: cents(275),
});
await insertSchedule(impeller, {
  task_type: "REPLACE",
  label: "Replace impeller",
  interval_months: 12,
  base_on: addDays(addMonths(today, -12), -18),
});

const boatOil = await insertPart(boat, {
  name: "Engine Oil & Filter Service Kit",
  category: "FLUIDS",
  manufacturer: "Yamaha",
  part_number: "LUB-MRNKT-00-10",
  is_modification: 0,
  is_oem: 1,
  installed_on: addMonths(today, -3),
  installed_hours: 180,
  installed_by: "SELF",
  part_cost_cents: cents(129.99),
  quantity: 2,
});
await insertSchedule(boatOil, {
  task_type: "SERVICE",
  label: "Oil and filter change",
  interval_hours: 100,
  interval_months: 12,
  base_hours: 180,
  base_on: addMonths(today, -3),
});

await insertPart(boat, {
  name: "Wet Sounds REV 10 Tower Speakers",
  category: "AUDIO",
  manufacturer: "Wet Sounds",
  part_number: "REV10-B",
  quantity: 2,
  installed_on: addMonths(today, -22),
  installed_hours: 96,
  installed_by: "SHOP",
  installer_name: "Lakeside Marine",
  part_cost_cents: cents(1_799),
  labor_cost_cents: cents(650),
  warranty_type: "MANUFACTURER",
  warranty_provider: "Wet Sounds",
  warranty_months: 24,
});

await insertPart(boat, {
  name: "Ballast Upgrade Kit",
  category: "ACCESSORIES",
  manufacturer: "Fly High",
  description: "Two 750 lb sacs with quick-fill plumbing.",
  installed_on: addMonths(today, -22),
  installed_hours: 96,
  part_cost_cents: cents(1_240),
  labor_cost_cents: cents(400),
});

const counts = {};
for (const table of ["vehicle", "part", "maintenance_schedule", "service_record"]) {
  counts[table] = Number((await sql(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
}

console.log(
  `Seeded ${counts.vehicle} vehicles, ${counts.part} parts, ` +
    `${counts.maintenance_schedule} schedules, ${counts.service_record} service records.`,
);
