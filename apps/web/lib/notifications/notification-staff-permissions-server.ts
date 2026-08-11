import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import { scheduleNotificationDeliverForEvent } from "@/lib/notifications/schedule-notification-deliver";
import { restaurantPermissionLabel } from "@/lib/permissions/restaurant-permissions";

export type PermissionGrantTarget = {
  profileId: string;
  restaurantId: string;
};

export async function emitStaffPermissionsGrantedForTargets(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    actorUserId: string;
    addedKeys: string[];
    positionName?: string | null;
    targets: PermissionGrantTarget[];
  },
): Promise<{ unlockIds: string[]; eventIds: string[] }> {
  const uniqueKeys = [...new Set(params.addedKeys.filter(Boolean))];
  if (uniqueKeys.length === 0 || params.targets.length === 0) {
    return { unlockIds: [], eventIds: [] };
  }

  const labels = uniqueKeys.map((key) => restaurantPermissionLabel(key));
  const unlockIds: string[] = [];
  const eventIds: string[] = [];

  for (const target of params.targets) {
    if (target.profileId === params.actorUserId) continue;

    const { data: unlockRow, error: unlockError } = await admin
      .from("user_permission_unlocks")
      .insert({
        profile_id: target.profileId,
        restaurant_id: params.restaurantId,
        permission_keys: uniqueKeys,
        permission_labels: labels,
        position_name: params.positionName ?? null,
        granted_by: params.actorUserId,
      })
      .select("id")
      .single();

    if (unlockError || !unlockRow) {
      console.warn(
        "[permissions-granted] unlock insert",
        unlockError?.message,
      );
      continue;
    }

    const unlockId = (unlockRow as { id: string }).id;
    unlockIds.push(unlockId);

    const referenceId = unlockId;
    const { data: existing } = await admin
      .from("notification_events")
      .select("id")
      .eq("module", "staff_permissions_granted")
      .eq("reference_id", referenceId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();

    if (existing) {
      eventIds.push((existing as { id: string }).id);
      continue;
    }

    const { data: eventRow, error: eventError } = await admin
      .from("notification_events")
      .insert({
        restaurant_id: params.restaurantId,
        module: "staff_permissions_granted",
        reference_id: referenceId,
        payload: {
          unlockId,
          targetProfileId: target.profileId,
          permissionKeys: uniqueKeys,
          permissionLabels: labels,
          positionName: params.positionName ?? null,
          actorUserId: params.actorUserId,
          actorProfileId: params.actorUserId,
        },
      })
      .select("id")
      .single();

    if (eventError || !eventRow) {
      console.warn(
        "[permissions-granted] event insert",
        eventError?.message,
      );
      continue;
    }

    const eventId = (eventRow as { id: string }).id;
    eventIds.push(eventId);
    scheduleNotificationDeliverForEvent(admin, eventId);
  }

  return { unlockIds, eventIds };
}

export async function filterStaffPermissionsGrantedPushTargets(
  event: { payload: Record<string, unknown> | null },
  targets: PermissionGrantTarget[],
): Promise<PermissionGrantTarget[]> {
  const targetProfileId = event.payload?.targetProfileId;
  if (typeof targetProfileId !== "string" || !targetProfileId) {
    return [];
  }
  return targets.filter((t) => t.profileId === targetProfileId);
}

export async function loadStaffPermissionsGrantedNotificationItems(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; limit?: number },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const limit = params.limit ?? 5;

  const { data: dismissed } = await sb
    .from("restaurant_staff_permission_notification_dismissals")
    .select("unlock_id")
    .eq("profile_id", params.userId)
    .eq("restaurant_id", params.restaurantId);

  const dismissedIds = new Set(
    (dismissed ?? []).map((r) => (r as { unlock_id: string }).unlock_id),
  );

  const { data: events } = await sb
    .from("notification_events")
    .select("id, reference_id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", "staff_permissions_granted")
    .order("created_at", { ascending: false })
    .limit(40);

  const items: NotificationItem[] = [];
  let totalCount = 0;

  for (const raw of events ?? []) {
    const row = raw as {
      id: string;
      reference_id: string;
      payload: Record<string, unknown> | null;
      created_at: string;
    };
    const payload = row.payload ?? {};
    if (payload.targetProfileId !== params.userId) continue;

    const unlockId =
      typeof payload.unlockId === "string"
        ? payload.unlockId
        : row.reference_id;
    if (dismissedIds.has(unlockId)) continue;

    totalCount += 1;
    if (items.length >= limit) continue;

    const labels = Array.isArray(payload.permissionLabels)
      ? payload.permissionLabels.filter(
          (v): v is string => typeof v === "string",
        )
      : [];
    const preview =
      labels.length === 0
        ? "Neue Modul-Rechte freigeschaltet"
        : labels.length <= 2
          ? labels.join(", ")
          : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;

    items.push({
      id: unlockId,
      title: "Neue Rechte freigeschaltet",
      subtitle: preview,
      href: APP_ROUTES.dashboard,
      at: row.created_at,
      meta: { unlockId },
    });
  }

  return { items, totalCount };
}

export async function dismissStaffPermissionsGrantedNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    unlockId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_permission_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        unlock_id: params.unlockId,
      },
      { onConflict: "profile_id,restaurant_id,unlock_id" },
    );
  return { error: error?.message ?? null };
}

export async function dismissAllStaffPermissionsGrantedNotifications(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const { data: events } = await sb
    .from("notification_events")
    .select("reference_id, payload")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", "staff_permissions_granted")
    .limit(100);

  const unlockIds = new Set<string>();
  for (const raw of events ?? []) {
    const row = raw as {
      reference_id: string;
      payload: Record<string, unknown> | null;
    };
    if (row.payload?.targetProfileId !== params.userId) continue;
    const unlockId =
      typeof row.payload?.unlockId === "string"
        ? row.payload.unlockId
        : row.reference_id;
    unlockIds.add(unlockId);
  }

  if (unlockIds.size === 0) return { error: null };

  const { error } = await sb
    .from("restaurant_staff_permission_notification_dismissals")
    .upsert(
      [...unlockIds].map((unlock_id) => ({
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        unlock_id,
      })),
      { onConflict: "profile_id,restaurant_id,unlock_id" },
    );
  return { error: error?.message ?? null };
}
