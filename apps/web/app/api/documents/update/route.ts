import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  insertRestaurantDocumentLog,
  resolveRestaurantEmployeeId,
} from "@/lib/documents/document-log-server";
import { emitStaffDocumentAssignedNotification } from "@/lib/notifications/notification-staff-document-server";
import type { DocumentLogChange } from "@/lib/types/document-log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    staffId?: string | null;
    visibleToStaff?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const documentId = body.documentId?.trim() ?? "";
  const title =
    typeof body.title === "string" ? body.title.trim() : undefined;
  const tagIdProvided = body.tagId !== undefined;
  const staffIdProvided = body.staffId !== undefined;
  const visibleToStaffProvided = body.visibleToStaff !== undefined;

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(documentId) ||
    (!title && !tagIdProvided && !staffIdProvided && !visibleToStaffProvided)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const userSb = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await userSb
    .from("restaurant_documents")
    .select("id, title, tag_id, staff_id, visible_to_staff, file_name, employee_id")
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

  const nextStaffId = staffIdProvided
    ? body.staffId && String(body.staffId).trim()
      ? String(body.staffId).trim()
      : null
    : (existing.staff_id as string | null);

  if (nextStaffId) {
    const { data: staffRow } = await admin
      .from("restaurant_staff")
      .select("id")
      .eq("id", nextStaffId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!staffRow?.id) {
      return Response.json({ error: "invalid_staff" }, { status: 400 });
    }
  }

  const nextVisibleToStaff = visibleToStaffProvided
    ? Boolean(body.visibleToStaff) && nextStaffId != null
    : Boolean(existing.visible_to_staff);

  if (tagIdProvided && nextTagId) {
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

  if (
    staffIdProvided &&
    (existing.staff_id as string | null) !== nextStaffId
  ) {
    changes.push({
      field: "staff",
      from: (existing.staff_id as string | null) ?? null,
      to: nextStaffId,
    });
  }

  if (
    visibleToStaffProvided &&
    Boolean(existing.visible_to_staff) !== nextVisibleToStaff
  ) {
    changes.push({
      field: "visible_to_staff",
      from: existing.visible_to_staff ? "sichtbar" : "nur HR",
      to: nextVisibleToStaff ? "sichtbar" : "nur HR",
    });
  }

  const patch: Record<string, unknown> = {};
  if (title) patch.title = title;
  if (tagIdProvided) patch.tag_id = nextTagId;
  if (staffIdProvided) patch.staff_id = nextStaffId;
  if (staffIdProvided || visibleToStaffProvided) {
    patch.visible_to_staff = nextVisibleToStaff;
  }

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

  const becameVisible =
    nextVisibleToStaff &&
    nextStaffId &&
    (!Boolean(existing.visible_to_staff) || existing.staff_id !== nextStaffId);

  if (becameVisible) {
    const { data: staffRow } = await admin
      .from("restaurant_staff")
      .select("profile_id")
      .eq("id", nextStaffId)
      .maybeSingle();
    await emitStaffDocumentAssignedNotification(admin, {
      restaurantId,
      documentId,
      staffId: nextStaffId,
      targetProfileId: (staffRow?.profile_id as string | null) ?? null,
      documentTitle: nextTitle,
      actorUserId: auth.userId,
      visibleToStaff: true,
    });
  }

  return Response.json({ ok: true });
}
