import fs from "node:fs/promises";

import { getAttachment } from "@/lib/queries";
import { isImage } from "@/lib/mime";
import { uploadPath } from "@/lib/uploads";

/**
 * Serves an uploaded receipt, invoice or photo from the data directory. Files
 * are looked up by attachment id, never by path, and only the content types the
 * uploader accepts are stored in the first place.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const attachment = getAttachment(id);
  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  let file: Buffer;
  try {
    file = await fs.readFile(uploadPath(attachment.stored_name));
  } catch {
    return new Response("File is missing from storage", { status: 404 });
  }

  // Inline for things a browser renders safely; everything else downloads.
  const inline = isImage(attachment.mime_type) || attachment.mime_type === "application/pdf";
  const encodedName = encodeURIComponent(attachment.file_name);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": attachment.mime_type,
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
