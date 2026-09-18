/**
 * Pure MIME helpers, kept free of server-only imports so that components can
 * use them without pulling the filesystem layer into their import graph.
 */

/** Receipts and build photos only: images plus PDF. */
export const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

export function isAllowedMime(mime: string): boolean {
  return mime in ALLOWED_UPLOAD_MIME;
}

export function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}
