import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const POS_RECEIPTS_BUCKET = "pos-receipts";

const SIGNED_URL_TTL_SEC = 3600;

export function posReceiptStoragePath(
  restaurantId: string,
  orderId: string,
): string {
  return `${restaurantId}/${orderId}.pdf`;
}

export async function uploadPosReceiptPdf(
  restaurantId: string,
  orderId: string,
  buffer: Buffer,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("admin_unavailable");
  }

  const path = posReceiptStoragePath(restaurantId, orderId);
  const { error } = await admin.storage
    .from(POS_RECEIPTS_BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function resolvePosReceiptSignedUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath?.trim()) return null;

  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage
    .from(POS_RECEIPTS_BUCKET)
    .createSignedUrl(storagePath.trim(), SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    console.warn("[pos] receipt signed url", error?.message);
    return null;
  }

  return data.signedUrl;
}
