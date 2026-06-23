import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { assertCanAccessStaffDocument } from "@/lib/staff/staff-documents-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const documentId = url.searchParams.get("documentId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(documentId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const access = await assertCanAccessStaffDocument({
    restaurantId,
    documentId,
    userId: auth.userId,
  });
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status });
  }

  const row = access.row;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: blob, error: dlError } = await admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .download(row.storage_path as string);

  if (dlError || !blob) {
    return Response.json({ error: dlError?.message ?? "download_failed" }, { status: 500 });
  }

  const fileName = (row.file_name as string) || "dokument";
  const mime = (row.mime_type as string) || "application/octet-stream";
  const inline = url.searchParams.get("inline") === "1";

  return new Response(blob, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": inline
        ? `inline; filename="${encodeURIComponent(fileName)}"`
        : `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
