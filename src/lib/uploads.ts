import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { newId, UPLOAD_DIR } from "./db";
import { ALLOWED_UPLOAD_MIME, isAllowedMime } from "./mime";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export interface StoredUpload {
  id: string;
  storedName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export class UploadError extends Error {}

/**
 * Writes an uploaded file to the data directory under a generated name. The
 * original name is kept only as metadata so it can never influence the path.
 */
export async function storeUpload(file: File): Promise<StoredUpload> {
  if (!isAllowedMime(file.type)) {
    throw new UploadError(`"${file.name}" is a ${file.type || "unknown"} file. Upload an image or PDF.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`"${file.name}" is larger than the 20 MB limit.`);
  }
  if (file.size === 0) {
    throw new UploadError(`"${file.name}" is empty.`);
  }

  const id = newId("att");
  const storedName = `${id}${ALLOWED_UPLOAD_MIME[file.type]}`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));

  return {
    id,
    storedName,
    fileName: path.basename(file.name).slice(0, 200) || "upload",
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function uploadPath(storedName: string): string {
  // Guard against a stored name that somehow escapes the upload directory.
  const resolved = path.resolve(UPLOAD_DIR, path.basename(storedName));
  if (path.dirname(resolved) !== path.resolve(UPLOAD_DIR)) {
    throw new UploadError("Invalid file reference.");
  }
  return resolved;
}

export async function deleteUploadFile(storedName: string): Promise<void> {
  await fs.rm(uploadPath(storedName), { force: true });
}
