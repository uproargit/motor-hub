import "server-only";

import { createClient as createWebClient, type Client, type InArgs, type Transaction } from "@libsql/client/web";
import fs from "node:fs";
import path from "node:path";

import { splitStatements } from "./sql-file.mjs";

export const DATA_DIR = process.env.MOTOR_HUB_DATA_DIR
  ? path.resolve(process.env.MOTOR_HUB_DATA_DIR)
  : path.join(process.cwd(), "data");

/** Only used by the local-disk storage driver; ignored when R2 is configured. */
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/**
 * Opens the database.
 *
 * A hosted Turso database is reached over HTTP, which the `web` client does with
 * no native code. The default export instead links the `libsql` native module —
 * 20 MB of platform binaries that a serverless deploy neither needs nor wants —
 * so it is imported lazily and only for a local `file:` database.
 */
async function open(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;

  if (url && !url.startsWith("file:")) {
    return createWebClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const { createClient } = await import("@libsql/client");
  return createClient({ url: url ?? `file:${path.join(DATA_DIR, "motor-hub.db")}` });
}

// Next reloads modules between requests in development, so the connection and
// the one-time schema application are cached on globalThis.
const globalForDb = globalThis as unknown as {
  __motorHubClient?: Promise<Client>;
  __motorHubReady?: Promise<Client>;
};

function client(): Promise<Client> {
  globalForDb.__motorHubClient ??= open();
  return globalForDb.__motorHubClient;
}

/**
 * Applies the schema once per process. Every statement is `IF NOT EXISTS`, so
 * it is safe to run against an existing database on each cold start.
 */
async function applySchema(): Promise<Client> {
  const db = await client();
  const schema = fs.readFileSync(path.join(process.cwd(), "src", "lib", "schema.sql"), "utf8");

  for (const statement of splitStatements(schema)) {
    await db.execute(statement);
  }

  return db;
}

/** Resolves to a connection that is guaranteed to have the schema applied. */
export function ready(): Promise<Client> {
  globalForDb.__motorHubReady ??= applySchema();
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
  const db = await ready();
  const result = await db.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
  return result.rows.map((row) => toObject<T>(row as unknown as Record<string, unknown>));
}

export async function one<T>(sql: string, args?: InArgs): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args?: InArgs): Promise<void> {
  const db = await ready();
  await db.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
}

export async function txRun(tx: Transaction, sql: string, args?: InArgs): Promise<void> {
  await tx.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
}

export async function txAll<T>(tx: Transaction, sql: string, args?: InArgs): Promise<T[]> {
  const result = await tx.execute(args === undefined ? sql : { sql, args: normalizeArgs(args) });
  return result.rows.map((row) => toObject<T>(row as unknown as Record<string, unknown>));
}

/** Runs several writes atomically, e.g. the part replacement flow. */
export async function writeTransaction(work: (tx: Transaction) => Promise<void>): Promise<void> {
  const db = await ready();
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
