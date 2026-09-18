/**
 * Dumps the database to a timestamped .sql file you can restore from.
 *
 *   npm run backup                      # local database -> ./backups
 *   TURSO_DATABASE_URL=... npm run backup   # the hosted one
 *   npm run backup -- --out /path/to/dir
 *
 * The output is plain INSERT statements, so restoring is: create the schema
 * (the app does that on first run) and replay the file.
 *
 * Worth running on a schedule — this is the record you are keeping for years,
 * and it is the one thing no hosting plan does for you on a free tier.
 */

import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const outFlag = process.argv.indexOf("--out");
const OUT_DIR = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(ROOT, "backups");

const TABLES = ["vehicle", "usage_reading", "part", "maintenance_schedule", "service_record", "attachment"];

const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? `file:${path.join(ROOT, "data", "motor-hub.db")}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

/** SQLite literal for a JS value. */
function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(OUT_DIR, `motor-hub-${stamp}.sql`);

const lines = [
  `-- Motor Hub backup taken ${new Date().toISOString()}`,
  `-- Restore: let the app create the schema, then replay this file.`,
  "BEGIN TRANSACTION;",
];

let total = 0;
for (const table of TABLES) {
  const result = await db.execute(`SELECT * FROM ${table}`);
  if (result.rows.length === 0) continue;

  const columns = result.columns;
  lines.push("", `-- ${table} (${result.rows.length} rows)`);
  for (const row of result.rows) {
    const values = columns.map((column) => literal(row[column])).join(", ");
    lines.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values});`);
  }
  total += result.rows.length;
}

lines.push("", "COMMIT;", "");
fs.writeFileSync(target, lines.join("\n"), "utf8");

const kb = (fs.statSync(target).size / 1024).toFixed(1);
console.log(`Backed up ${total} rows from ${TABLES.length} tables to ${target} (${kb} KB)`);
console.log("Note: this covers the database only. Receipts and photos live in R2 (or ./data/uploads).");
