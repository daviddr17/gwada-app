import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import { isSelfOriginatedNotification } from "@/lib/notifications/notification-self-origin";

export async function emitStaffContractSignedNotification(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contractId: string;
    staffId: string;
    targetProfileId: string | null;
    contractTitle: string;
    documentId: string | null;
    actorUserId: string;
    revised: boolean;
    pendingEmployeeSignature?: boolean;
  },
): Promise<void> {
  if (!params.targetProfileId) return;
  if (
    isSelfOriginatedNotification(
      params.targetProfileId,
      params.actorUserId,
    )
  ) {
    return;
  }

  const referenceId = params.pendingEmployeeSignature
    ? `${params.contractId}:pending-employee`
    : `${params.contractId}:${params.documentId ?? "doc"}`;
  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("module", "staff_contract_signed")
    .eq("reference_id", referenceId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (existing) return;

  await admin.from("notification_events").insert({
    restaurant_id: params.restaurantId,
    module: "staff_contract_signed",
    reference_id: referenceId,
    payload: {
      contractId: params.contractId,
      staffId: params.staffId,
      targetProfileId: params.targetProfileId,
      contractTitle: params.contractTitle,
      documentId: params.documentId,
      actorUserId: params.actorUserId,
      actorProfileId: params.actorUserId,
      revised: params.revised,
      pendingEmployeeSignature: params.pendingEmployeeSignature ?? false,
    },
  });
}

export async function filterStaffContractSignedPushTargets(
  admin: SupabaseClient,
  event: { payload: Record<string, unknown> | null },
  targets: { profileId: string; restaurantId: string }[],
): Promise<{ profileId: string; restaurantId: string }[]> {
  const targetProfileId = event.payload?.targetProfileId;
  if (typeof targetProfileId !== "string" || !targetProfileId) {
    return [];
  }
  return targets.filter((t) => t.profileId === targetProfileId);
}

export async function loadStaffContractSignedNotificationItems(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
): Promise<NotificationItem[]> {
  const limit = params.limit ?? 5;

  const { data: dismissed } = await sb
    .from("restaurant_staff_contract_notification_dismissals")
    .select("contract_id")
    .eq("profile_id", params.userId)
    .eq("restaurant_id", params.restaurantId);

  const dismissedIds = new Set(
    (dismissed ?? []).map((r) => (r as { contract_id: string }).contract_id),
  );

  const { data: events } = await sb
    .from("notification_events")
    .select("id, reference_id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", "staff_contract_signed")
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

    const contractId = payload.contractId;
    if (typeof contractId !== "string" || dismissedIds.has(contractId)) continue;

    const title =
      typeof payload.contractTitle === "string"
        ? payload.contractTitle
        : "Arbeitsvertrag";
    const revised = payload.revised === true;
    const pending = payload.pendingEmployeeSignature === true;

    items.push({
      id: contractId,
      title: pending
        ? "Vertrag unterschreiben"
        : revised
          ? "Vertrag überarbeitet"
          : "Neuer Arbeitsvertrag",
      subtitle: pending
        ? "Bitte im Profil unter Meine Dokumente unterschreiben."
        : title,
      href: "/profile/dokumente",
      at: row.created_at,
      meta: {
        contractId,
        documentId:
          typeof payload.documentId === "string" ? payload.documentId : "",
      },
    });

    if (items.length >= limit) break;
  }

  return items;
}

export async function dismissStaffContractSignedNotification(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; contractId: string },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_contract_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        contract_id: params.contractId,
      },
      { onConflict: "profile_id,restaurant_id,contract_id" },
    );
  return { error: error?.message ?? null };
}

export async function dismissAllStaffContractSignedNotifications(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const { data: events } = await sb
    .from("notification_events")
    .select("payload")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", "staff_contract_signed")
    .limit(100);

  const rows = (events ?? [])
    .map((e) => (e as { payload: Record<string, unknown> | null }).payload)
    .filter((p) => p?.targetProfileId === params.userId)
    .map((p) => ({
      profile_id: params.userId,
      restaurant_id: params.restaurantId,
      contract_id: p?.contractId as string,
    }))
    .filter((r) => r.contract_id);

  if (rows.length === 0) return { error: null };

  const { error } = await sb
    .from("restaurant_staff_contract_notification_dismissals")
    .upsert(rows, { onConflict: "profile_id,restaurant_id,contract_id" });

  return { error: error?.message ?? null };
}
