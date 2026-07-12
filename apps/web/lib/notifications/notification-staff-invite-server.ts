import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import { isSelfOriginatedNotification } from "@/lib/notifications/notification-self-origin";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";

const INVITE_RESPONSE_MODULES = [
  "staff_invite_accepted",
  "staff_invite_declined",
] as const;

type InviteResponseModule = (typeof INVITE_RESPONSE_MODULES)[number];

function isInviteResponseModule(
  module: NotificationModuleId,
): module is InviteResponseModule {
  return (INVITE_RESPONSE_MODULES as readonly string[]).includes(module);
}

async function fetchDismissedInviteIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
    module: InviteResponseModule;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_staff_invite_notification_dismissals")
    .select("invite_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module);

  return new Set(
    (data ?? []).map((row) => (row as { invite_id: string }).invite_id),
  );
}

function actorDisplayName(payload: Record<string, unknown>): string {
  const given = typeof payload.actorGivenName === "string" ? payload.actorGivenName.trim() : "";
  const family = typeof payload.actorFamilyName === "string" ? payload.actorFamilyName.trim() : "";
  const name = `${given} ${family}`.trim();
  return name || "Mitarbeiter";
}

export async function loadStaffInviteResponseNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: InviteResponseModule;
    limit?: number;
  },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const limit = params.limit ?? 5;
  const def = NOTIFICATION_MODULES[params.module];
  const dismissed = await fetchDismissedInviteIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    module: params.module,
  });

  const { data: events, error } = await sb
    .from("notification_events")
    .select("id, reference_id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[gwada] staff invite response bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const rows = (events ?? []).filter((raw) => {
    const row = raw as {
      reference_id: string;
      payload: Record<string, unknown> | null;
    };
    const payload = row.payload ?? {};
    if (payload.targetProfileId !== params.userId) return false;
    if (dismissed.has(row.reference_id)) return false;
    const actorUserId = payload.actorUserId;
    if (
      typeof actorUserId === "string" &&
      isSelfOriginatedNotification(params.userId, actorUserId)
    ) {
      return false;
    }
    return true;
  });

  const items = rows.slice(0, limit).map((raw) => {
    const row = raw as {
      reference_id: string;
      payload: Record<string, unknown> | null;
      created_at: string;
    };
    const payload = row.payload ?? {};
    const staffName =
      typeof payload.staffName === "string" ? payload.staffName : "Mitarbeiter";
    const positionName =
      typeof payload.positionName === "string" ? payload.positionName.trim() : "";
    const actor = actorDisplayName(payload);

    return {
      id: row.reference_id,
      title:
        params.module === "staff_invite_accepted"
          ? "Einladung angenommen"
          : "Einladung abgelehnt",
      subtitle: positionName
        ? `${actor} · ${staffName} · ${positionName}`
        : `${actor} · ${staffName}`,
      href: def.href,
      at: row.created_at,
      meta: {
        inviteId: row.reference_id,
        staffId:
          typeof payload.staffId === "string" ? payload.staffId : "",
      },
    };
  });

  return { items, totalCount: rows.length };
}

export async function filterStaffInviteResponsePushTargets(
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

export async function dismissStaffInviteResponseNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    inviteId: string;
    module: InviteResponseModule;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_invite_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        invite_id: params.inviteId,
        module: params.module,
      },
      { onConflict: "profile_id,restaurant_id,invite_id,module" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllStaffInviteResponseNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: InviteResponseModule;
  },
): Promise<{ error: string | null }> {
  const { data: events } = await sb
    .from("notification_events")
    .select("reference_id, payload")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module)
    .limit(100);

  const rows = (events ?? [])
    .filter(
      (e) =>
        (e as { payload: Record<string, unknown> | null }).payload
          ?.targetProfileId === params.userId,
    )
    .map((e) => ({
      profile_id: params.userId,
      restaurant_id: params.restaurantId,
      invite_id: (e as { reference_id: string }).reference_id,
      module: params.module,
    }));

  if (rows.length === 0) return { error: null };

  const { error } = await sb
    .from("restaurant_staff_invite_notification_dismissals")
    .upsert(rows, {
      onConflict: "profile_id,restaurant_id,invite_id,module",
    });

  return { error: error?.message ?? null };
}

export function isStaffInviteResponseModule(
  module: NotificationModuleId,
): module is InviteResponseModule {
  return isInviteResponseModule(module);
}
