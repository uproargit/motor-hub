import "server-only";

import path from "node:path";

import { newId } from "./db";
import { ALLOWED_UPLOAD_MIME, isAllowedMime } from "./mime";
import { storage } from "./storage";

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
 * Writes an uploaded file to the configured store under a generated name. The
 * original name is kept only as metadata so it can never influence the key.
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

  await storage.put(storedName, new Uint8Array(await file.arrayBuffer()), file.type);

  return {
    id,
    storedName,
    fileName: path.basename(file.name).slice(0, 200) || "upload",
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function readUpload(storedName: string): Promise<Uint8Array | null> {
  return storage.get(storedName);
}

export async function deleteUploadFile(storedName: string): Promise<void> {
  await storage.remove(storedName);
}
