import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { isSelfOriginatedNotification } from "@/lib/notifications/notification-self-origin";

export async function emitStaffDocumentAssignedNotification(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    documentId: string;
    staffId: string;
    targetProfileId: string | null;
    documentTitle: string;
    actorUserId: string;
    visibleToStaff: boolean;
  },
): Promise<void> {
  if (!params.visibleToStaff || !params.targetProfileId) return;
  if (
    isSelfOriginatedNotification(params.targetProfileId, params.actorUserId)
  ) {
    return;
  }

  const referenceId = params.documentId;
  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("module", "staff_document_assigned")
    .eq("reference_id", referenceId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (existing) return;

  await admin.from("notification_events").insert({
    restaurant_id: params.restaurantId,
    module: "staff_document_assigned",
    reference_id: referenceId,
    payload: {
      documentId: params.documentId,
      staffId: params.staffId,
      targetProfileId: params.targetProfileId,
      documentTitle: params.documentTitle,
      actorUserId: params.actorUserId,
      actorProfileId: params.actorUserId,
    },
  });
}

export async function filterStaffDocumentAssignedPushTargets(
  _admin: SupabaseClient,
  event: { payload: Record<string, unknown> | null },
  targets: { profileId: string; restaurantId: string }[],
): Promise<{ profileId: string; restaurantId: string }[]> {
  const targetProfileId = event.payload?.targetProfileId;
  if (typeof targetProfileId !== "string" || !targetProfileId) {
    return [];
  }
  return targets.filter((t) => t.profileId === targetProfileId);
}

export async function loadStaffDocumentAssignedNotificationItems(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
): Promise<NotificationItem[]> {
  const limit = params.limit ?? 5;

  const { data: dismissed } = await sb
    .from("restaurant_staff_document_notification_dismissals")
    .select("document_id")
    .eq("profile_id", params.userId)
    .eq("restaurant_id", params.restaurantId);

  const dismissedIds = new Set(
    (dismissed ?? []).map((r) => (r as { document_id: string }).document_id),
  );

  const { data: events } = await sb
    .from("notification_events")
    .select("id, reference_id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", "staff_document_assigned")
    .order("created_at", { ascending: false })
    .limit(30);

  const items: NotificationItem[] = [];
  for (const raw of events ?? []) {
    const row = raw as {
      id: string;
      payload: Record<string, unknown> | null;
      created_at: string;
    };
    const payload = row.payload ?? {};
    const targetProfileId = payload.targetProfileId;
    if (targetProfileId !== params.userId) continue;

    const actorUserId = payload.actorUserId;
    if (
      typeof actorUserId === "string" &&
      isSelfOriginatedNotification(params.userId, actorUserId)
    ) {
      continue;
    }

    const documentId = payload.documentId;
    if (typeof documentId !== "string" || dismissedIds.has(documentId)) continue;

    const title =
      typeof payload.documentTitle === "string" && payload.documentTitle.trim()
        ? payload.documentTitle.trim()
        : "Neues Dokument";

    items.push({
      id: documentId,
      title: "Neues Dokument",
      subtitle: title,
      href: APP_ROUTES.profile.documents,
      at: row.created_at,
      meta: { documentId },
    });
    if (items.length >= limit) break;
  }

  return items;
}

export async function markStaffDocumentAssignedRead(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    documentId?: string;
    all?: boolean;
  },
): Promise<void> {
  if (params.all) {
    const { data: events } = await sb
      .from("notification_events")
      .select("reference_id, payload")
      .eq("restaurant_id", params.restaurantId)
      .eq("module", "staff_document_assigned");

    const docIds = (events ?? [])
      .filter((e) => {
        const p = (e as { payload: Record<string, unknown> | null }).payload;
        return p?.targetProfileId === params.userId;
      })
      .map((e) => (e as { reference_id: string }).reference_id)
      .filter(Boolean);

    if (docIds.length === 0) return;

    await sb.from("restaurant_staff_document_notification_dismissals").upsert(
      docIds.map((documentId) => ({
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        document_id: documentId,
      })),
      { onConflict: "profile_id,restaurant_id,document_id" },
    );
    return;
  }

  if (!params.documentId) return;

  await sb.from("restaurant_staff_document_notification_dismissals").upsert(
    {
      profile_id: params.userId,
      restaurant_id: params.restaurantId,
      document_id: params.documentId,
    },
    { onConflict: "profile_id,restaurant_id,document_id" },
  );
}
