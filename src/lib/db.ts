import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.MOTOR_HUB_DATA_DIR
  ? path.resolve(process.env.MOTOR_HUB_DATA_DIR)
  : path.join(process.cwd(), "data");

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const DB_PATH = path.join(DATA_DIR, "motor-hub.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "schema.sql");

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return database;
}

// Next.js reloads modules between requests in development, so the handle is
// cached on globalThis to avoid opening a new connection on every edit.
const globalForDb = globalThis as unknown as { __motorHubDb?: Database.Database };

export const db: Database.Database = globalForDb.__motorHubDb ?? open();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__motorHubDb = db;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
