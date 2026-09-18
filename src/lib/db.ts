import "server-only";

import { createClient, type Client, type InArgs, type Transaction } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

import { splitStatements } from "./sql-file.mjs";

export const DATA_DIR = process.env.MOTOR_HUB_DATA_DIR
  ? path.resolve(process.env.MOTOR_HUB_DATA_DIR)
  : path.join(process.cwd(), "data");

/** Only used by the local-disk storage driver; ignored when R2 is configured. */
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/**
 * The libSQL client speaks SQLite whether it is talking to a local file or to
 * a hosted Turso database, so the same SQL runs in development and production.
 * Set TURSO_DATABASE_URL to point at the hosted one.
 */
function open(): Client {
  const url = process.env.TURSO_DATABASE_URL;

  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: `file:${path.join(DATA_DIR, "motor-hub.db")}` });
}

const globalForDb = globalThis as unknown as { __motorHubDb?: Client; __motorHubReady?: Promise<void> };

export const db: Client = globalForDb.__motorHubDb ?? open();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__motorHubDb = db;
}

/**
 * Applies the schema once per process. Every statement is `IF NOT EXISTS`, so
 * this is safe to run against an existing database on each cold start.
 */
function ensureSchema(): Promise<void> {
  const schema = fs.readFileSync(path.join(process.cwd(), "src", "lib", "schema.sql"), "utf8");
  const statements = splitStatements(schema);

  return (async () => {
    for (const statement of statements) {
      await db.execute(statement);
    }
  })();
}

export function ready(): Promise<void> {
  globalForDb.__motorHubReady ??= ensureSchema();
  return globalForDb.__motorHubReady;
}

/* ------------------------------------------------------------ accessors -- */

function toObject<T>(row: Record<string, unknown>): T {
  return { ...row } as T;
}

/**
 * The driver rejects `undefined`, which is easy to produce from an optional
 * field. Treating it as SQL NULL keeps that from becoming a runtime failure.
 */
function normalizeArgs(args: InArgs): InArgs {
  if (Array.isArray(args)) {
    return args.map((value) => (value === undefined ? null : value)) as InArgs;
  }

  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, value === undefined ? null : value]),
  ) as InArgs;
}

export async function all<T>(sql: string, args?: InArgs): Promise<T[]> {
  await ready();
  const result = await db.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
  return result.rows.map((row) => toObject<T>(row as unknown as Record<string, unknown>));
}

export async function one<T>(sql: string, args?: InArgs): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args?: InArgs): Promise<void> {
  await ready();
  await db.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
}

/** Runs several writes atomically, e.g. the part replacement flow. */
export async function txRun(tx: Transaction, sql: string, args?: InArgs): Promise<void> {
  await tx.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
}

export async function txAll<T>(tx: Transaction, sql: string, args?: InArgs): Promise<T[]> {
  const result = await tx.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
  return result.rows.map((row) => toObject<T>(row as unknown as Record<string, unknown>));
}

export async function writeTransaction(work: (tx: Transaction) => Promise<void>): Promise<void> {
  await ready();
  const tx = await db.transaction("write");
  try {
    await work(tx);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
