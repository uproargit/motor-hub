"use server";

import { revalidatePath } from "next/cache";

import { db } from "../db";
import { getAttachment, getPart } from "../queries";
import { deleteUploadFile } from "../uploads";
import { saveAttachments, toFormState, type FormState } from "./shared";

/** Adds receipts, invoices or photos to a part after the fact. */
export async function addPartAttachmentsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const partId = String(formData.get("part_id") ?? "");
  const part = getPart(partId);
  if (!part) return { error: "That part no longer exists." };

  try {
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return { error: "Choose at least one file to upload." };

    await saveAttachments(formData, { partId });
  } catch (error) {
    return toFormState(error);
  }

  revalidatePath(`/vehicles/${part.vehicle_id}`, "layout");
  return { ok: true };
}

export async function deleteAttachmentAction(formData: FormData): Promise<void> {
  const attachmentId = String(formData.get("attachment_id") ?? "");
  const attachment = getAttachment(attachmentId);
  if (!attachment) return;

  db.prepare(`DELETE FROM attachment WHERE id = ?`).run(attachmentId);
  await deleteUploadFile(attachment.stored_name);

  const part = attachment.part_id ? getPart(attachment.part_id) : null;
  if (part) revalidatePath(`/vehicles/${part.vehicle_id}`, "layout");
  else revalidatePath("/vehicles");
}
