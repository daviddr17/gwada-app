import { assertRestaurantPermissionApi } from "@/lib/documents/assert-restaurant-permission-api";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  insertRestaurantDocumentLog,
  resolveRestaurantEmployeeId,
} from "@/lib/documents/document-log-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

const MAX_BODY_LEN = 5000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    documentId?: string;
    body?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const documentId = body.documentId?.trim() ?? "";
  const noteBody = typeof body.body === "string" ? body.body.trim() : "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(documentId) ||
    !noteBody
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (noteBody.length > MAX_BODY_LEN) {
    return Response.json({ error: "note_too_long" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const { data: doc, error: fetchError } = await userSb
    .from("restaurant_documents")
    .select("id, title, file_name, employee_id")
    .eq("id", documentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!doc) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const employeeId =
    (doc.employee_id as string | null) ??
    (await resolveRestaurantEmployeeId(userSb, restaurantId, auth.userId));

  const { data: inserted, error: insertError } = await userSb
    .from("restaurant_document_note_entries")
    .insert({
      restaurant_id: restaurantId,
      document_id: documentId,
      employee_id: employeeId,
      actor_user_id: auth.userId,
      body: noteBody,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return Response.json(
      { error: insertError?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  await insertRestaurantDocumentLog(userSb, {
    restaurantId,
    documentId,
    employeeId,
    actorUserId: auth.userId,
    action: "note_added",
    documentTitle: doc.title as string,
    fileName: doc.file_name as string,
    details: { noteBody },
  });

  return Response.json({ ok: true, entryId: inserted.id as string });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    entryId?: string;
    body?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const entryId = body.entryId?.trim() ?? "";
  const noteBody = typeof body.body === "string" ? body.body.trim() : "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(entryId) ||
    !noteBody
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (noteBody.length > MAX_BODY_LEN) {
    return Response.json({ error: "note_too_long" }, { status: 400 });
  }

  const auth = await assertRestaurantPermissionApi(
    restaurantId,
    "documents.notes.edit",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const { data: entry, error: fetchError } = await userSb
    .from("restaurant_document_note_entries")
    .select("id, body, document_id, restaurant_id")
    .eq("id", entryId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!entry) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const oldBody = (entry.body as string).trim();
  if (oldBody === noteBody) {
    return Response.json({ ok: true });
  }

  const documentId = entry.document_id as string;

  const { data: doc, error: docError } = await userSb
    .from("restaurant_documents")
    .select("title, file_name, employee_id")
    .eq("id", documentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (docError || !doc) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { error: updateError } = await userSb
    .from("restaurant_document_note_entries")
    .update({ body: noteBody })
    .eq("id", entryId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  const employeeId =
    (doc.employee_id as string | null) ??
    (await resolveRestaurantEmployeeId(userSb, restaurantId, auth.userId));

  await insertRestaurantDocumentLog(userSb, {
    restaurantId,
    documentId,
    employeeId,
    actorUserId: auth.userId,
    action: "note_updated",
    documentTitle: doc.title as string,
    fileName: doc.file_name as string,
    details: { noteFrom: oldBody, noteTo: noteBody },
  });

  return Response.json({ ok: true });
}
