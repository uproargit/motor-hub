import "server-only";

import { AwsClient } from "aws4fetch";
import fs from "node:fs/promises";
import path from "node:path";

import { UPLOAD_DIR } from "./db";

/**
 * Where uploaded receipts and photos live.
 *
 * Local disk in development; Cloudflare R2 once the bucket is configured. R2 is
 * S3-compatible, and its zero egress fee is why files are proxied through the
 * app rather than served from signed URLs — that keeps one access-control point
 * and costs nothing extra.
 */
export interface StorageDriver {
  readonly name: "local" | "r2";
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

export class StorageError extends Error {}

/**
 * Copies into a plain ArrayBuffer, which is a valid fetch/Response body. A
 * Uint8Array may be backed by a SharedArrayBuffer, which is not.
 */
export function toBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Rejects a key that could escape the bucket prefix or the upload directory. */
function assertSafeKey(key: string): string {
  if (key !== path.basename(key) || key.startsWith(".")) {
    throw new StorageError("Invalid file reference.");
  }
  return key;
}

const localDriver: StorageDriver = {
  name: "local",

  async put(key, bytes) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, assertSafeKey(key)), bytes);
  },

  async get(key) {
    try {
      return new Uint8Array(await fs.readFile(path.join(UPLOAD_DIR, assertSafeKey(key))));
    } catch {
      return null;
    }
  },

  async remove(key) {
    await fs.rm(path.join(UPLOAD_DIR, assertSafeKey(key)), { force: true });
  },
};

function r2Driver(): StorageDriver {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const endpoint = process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;

  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });

  const urlFor = (key: string) => `${endpoint}/${bucket}/${assertSafeKey(key)}`;

  return {
    name: "r2",

    async put(key, bytes, contentType) {
      const response = await client.fetch(urlFor(key), {
        method: "PUT",
        body: toBody(bytes),
        headers: { "Content-Type": contentType, "Content-Length": String(bytes.byteLength) },
      });
      if (!response.ok) {
        throw new StorageError(`Upload failed (${response.status}). Check the R2 bucket configuration.`);
      }
    },

    async get(key) {
      const response = await client.fetch(urlFor(key));
      if (response.status === 404) return null;
      if (!response.ok) throw new StorageError(`Could not read the file (${response.status}).`);
      return new Uint8Array(await response.arrayBuffer());
    },

    async remove(key) {
      const response = await client.fetch(urlFor(key), { method: "DELETE" });
      // R2 returns 204 for a delete, and 404 when it was already gone.
      if (!response.ok && response.status !== 404) {
        throw new StorageError(`Could not delete the file (${response.status}).`);
      }
    },
  };
}

function select(): StorageDriver {
  const configured =
    process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;

  return configured ? r2Driver() : localDriver;
}

const globalForStorage = globalThis as unknown as { __motorHubStorage?: StorageDriver };

export const storage: StorageDriver = globalForStorage.__motorHubStorage ?? select();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.__motorHubStorage = storage;
}
