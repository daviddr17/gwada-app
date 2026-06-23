import { randomUUID } from "crypto";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  RESTAURANT_DOCUMENTS_QUOTA_BYTES,
  RESTAURANT_DOCUMENTS_STORAGE_BUCKET,
} from "@/lib/constants/restaurant-documents";
import {
  resolveRestaurantDocumentMime,
  validateRestaurantDocumentFile,
} from "@/lib/documents/validate-restaurant-document-file";
import { buildRestaurantDocumentStoragePath } from "@/lib/supabase/documents-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRestaurantEmployeeId } from "@/lib/documents/document-log-server";
import { insertRestaurantDocumentLog } from "@/lib/documents/document-log-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const restaurantIdRaw = form?.get("restaurantId");
  const restaurantId =
    typeof restaurantIdRaw === "string" ? restaurantIdRaw.trim() : "";
  const file = form?.get("file");
  const titleRaw = form?.get("title");

  if (!(file instanceof File) || !isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const fileError = validateRestaurantDocumentFile(file);
  if (fileError) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const mimeType = resolveRestaurantDocumentMime(file);
  if (!mimeType) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", auth.userId)
    .maybeSingle();

  if (!staffRow?.id) {
    return Response.json({ error: "no_staff_profile" }, { status: 404 });
  }

  const staffId = staffRow.id as string;

  const { data: usedRaw, error: usageError } = await admin.rpc(
    "restaurant_workspace_used_bytes",
    { p_restaurant_id: restaurantId },
  );
  if (usageError) {
    return Response.json({ error: usageError.message }, { status: 500 });
  }
  if (Number(usedRaw ?? 0) + file.size > RESTAURANT_DOCUMENTS_QUOTA_BYTES) {
    return Response.json({ error: "storage_quota_exceeded" }, { status: 413 });
  }

  const documentId = randomUUID();
  const title =
    (typeof titleRaw === "string" && titleRaw.trim()) ||
    file.name.replace(/\.[^.]+$/, "").trim() ||
    file.name;
  const storagePath = buildRestaurantDocumentStoragePath({
    restaurantId,
    documentId,
    fileName: file.name,
  });
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const userSb = await createSupabaseServerClient();
  const employeeId = await resolveRestaurantEmployeeId(
    userSb,
    restaurantId,
    auth.userId,
  );

  const { error: insertError } = await userSb.from("restaurant_documents").insert({
    id: documentId,
    restaurant_id: restaurantId,
    tag_id: null,
    employee_id: employeeId,
    staff_id: staffId,
    title,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: file.size,
    uploaded_by: auth.userId,
  });

  if (insertError) {
    await admin.storage.from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET).remove([storagePath]);
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  await insertRestaurantDocumentLog(userSb, {
    restaurantId,
    documentId,
    employeeId,
    actorUserId: auth.userId,
    action: "uploaded",
    documentTitle: title,
    fileName: file.name,
  });

  return Response.json({ documentId });
}
