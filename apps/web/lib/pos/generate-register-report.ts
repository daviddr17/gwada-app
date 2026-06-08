import "server-only";

import {
  getOpenRegisterSession,
  getRegisterSessionById,
  loadRegisterSessionAggregate,
} from "@/lib/pos/register-report-aggregate";
import { buildRegisterReportPdfBuffer } from "@/lib/pos/register-report-pdf";
import {
  resolveRegisterReportSignedUrl,
  uploadRegisterReportPdf,
} from "@/lib/pos/register-report-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function generateRegisterReportPdfUrl(params: {
  restaurantId: string;
  reportType: "X" | "Z";
  sessionId?: string;
}): Promise<
  | { ok: true; sessionId: string; pdfUrl: string }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "admin_unavailable", status: 500 };
  }

  const session =
    params.reportType === "X"
      ? await getOpenRegisterSession(params.restaurantId)
      : params.sessionId
        ? await getRegisterSessionById(params.sessionId, params.restaurantId)
        : null;

  if (!session) {
    return {
      ok: false,
      error:
        params.reportType === "X" ? "register_not_open" : "session_not_found",
      status: params.reportType === "X" ? 400 : 404,
    };
  }

  if (params.reportType === "Z" && !session.closed_at) {
    return { ok: false, error: "session_not_closed", status: 400 };
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", params.restaurantId)
    .maybeSingle();

  const aggregate = await loadRegisterSessionAggregate(session);
  const buffer = await buildRegisterReportPdfBuffer({
    reportType: params.reportType,
    restaurantName: restaurant?.name?.trim() || "Restaurant",
    aggregate,
  });

  const storagePath = await uploadRegisterReportPdf(
    params.restaurantId,
    params.reportType.toLowerCase() as "x" | "z",
    session.id,
    buffer,
  );

  const pdfUrl = await resolveRegisterReportSignedUrl(storagePath);
  if (!pdfUrl) {
    return { ok: false, error: "pdf_url_failed", status: 500 };
  }

  return { ok: true, sessionId: session.id, pdfUrl };
}
