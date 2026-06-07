import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  insertRestaurantDocumentLog,
  resolveRestaurantEmployeeId,
} from "@/lib/documents/document-log-server";
import { RESTAURANT_DOCUMENTS_STORAGE_BUCKET } from "@/lib/constants/restaurant-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    documentId?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const documentId = body.documentId?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(documentId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const { data: row, error: fetchError } = await userSb
    .from("restaurant_documents")
    .select("id, storage_path, title, file_name, employee_id")
    .eq("id", documentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const employeeId =
    (row.employee_id as string | null) ??
    (await resolveRestaurantEmployeeId(userSb, restaurantId, auth.userId));

  await insertRestaurantDocumentLog(userSb, {
    restaurantId,
    documentId,
    employeeId,
    actorUserId: auth.userId,
    action: "deleted",
    documentTitle: row.title as string,
    fileName: row.file_name as string,
  });

  const { error: deleteError } = await userSb
    .from("restaurant_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  if (admin && row.storage_path) {
    await admin.storage
      .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
      .remove([row.storage_path as string]);
  }

  return Response.json({ ok: true });
}
