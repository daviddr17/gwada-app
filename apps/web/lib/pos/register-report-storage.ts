import "server-only";

import { POS_RECEIPTS_BUCKET } from "@/lib/pos/receipt-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SEC = 3600;

export function registerReportStoragePath(
  restaurantId: string,
  reportType: "x" | "z",
  sessionId: string,
): string {
  return `${restaurantId}/reports/${reportType}-${sessionId}.pdf`;
}

export async function uploadRegisterReportPdf(
  restaurantId: string,
  reportType: "x" | "z",
  sessionId: string,
  buffer: Buffer,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin_unavailable");

  const path = registerReportStoragePath(restaurantId, reportType, sessionId);
  const { error } = await admin.storage
    .from(POS_RECEIPTS_BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) throw new Error(error.message);
  return path;
}

export async function resolveRegisterReportSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage
    .from(POS_RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    console.warn("[pos] register report signed url", error?.message);
    return null;
  }

  return data.signedUrl;
}
