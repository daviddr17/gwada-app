import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  insertRestaurantDocumentLog,
  resolveRestaurantEmployeeId,
} from "@/lib/documents/document-log-server";
import type { DocumentLogChange } from "@/lib/types/document-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

async function tagLabel(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tagId: string | null,
): Promise<string | null> {
  if (!tagId) return null;
  const { data } = await supabase
    .from("restaurant_document_tags")
    .select("name")
    .eq("id", tagId)
    .maybeSingle();
  return (data?.name as string | null) ?? null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    documentId?: string;
    title?: string;
    tagId?: string | null;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const documentId = body.documentId?.trim() ?? "";
  const title =
    typeof body.title === "string" ? body.title.trim() : undefined;
  const tagIdProvided = body.tagId !== undefined;

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(documentId) ||
    (!title && !tagIdProvided)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const userSb = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await userSb
    .from("restaurant_documents")
    .select("id, title, tag_id, file_name, employee_id")
    .eq("id", documentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const nextTagId = tagIdProvided
    ? body.tagId && String(body.tagId).trim()
      ? String(body.tagId).trim()
      : null
    : (existing.tag_id as string | null);

  if (nextTagId) {
    const { data: tag } = await userSb
      .from("restaurant_document_tags")
      .select("id")
      .eq("id", nextTagId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!tag) {
      return Response.json({ error: "invalid_tag" }, { status: 400 });
    }
  }

  const nextTitle = title ?? (existing.title as string);
  const changes: DocumentLogChange[] = [];

  if (title && title !== (existing.title as string)) {
    changes.push({
      field: "title",
      from: existing.title as string,
      to: title,
    });
  }

  const oldTagLabel = await tagLabel(userSb, existing.tag_id as string | null);
  const newTagLabel = await tagLabel(userSb, nextTagId);
  if (tagIdProvided && (existing.tag_id as string | null) !== nextTagId) {
    changes.push({
      field: "tag",
      from: oldTagLabel,
      to: newTagLabel,
    });
  }

  const patch: Record<string, unknown> = {};
  if (title) patch.title = title;
  if (tagIdProvided) patch.tag_id = nextTagId;

  const { error: updateError } = await userSb
    .from("restaurant_documents")
    .update(patch)
    .eq("id", documentId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  if (changes.length > 0) {
    const employeeId =
      (existing.employee_id as string | null) ??
      (await resolveRestaurantEmployeeId(userSb, restaurantId, auth.userId));

    await insertRestaurantDocumentLog(userSb, {
      restaurantId,
      documentId,
      employeeId,
      actorUserId: auth.userId,
      action: "updated",
      documentTitle: nextTitle,
      fileName: existing.file_name as string,
      details: { changes },
    });
  }

  return Response.json({ ok: true });
}
