import "server-only";

import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  formatPoStatusBellSubtitle,
  parsePoStatusLines,
  type PoStatusNotifyModuleId,
} from "@/lib/notifications/notification-po-status-copy";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import { shouldSkipNotificationForViewer } from "@/lib/notifications/notification-self-origin";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export function isPoStatusNotifyModule(
  module: string,
): module is PoStatusNotifyModuleId {
  return module === "inventory_po_ordered" || module === "inventory_po_closed";
}

async function fetchDismissedEventIds(
  sb: SupabaseClient,
  params: { profileId: string; restaurantId: string },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_inventory_po_status_dismissals")
    .select("event_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId);

  return new Set(
    (data ?? []).map((row) => (row as { event_id: string }).event_id),
  );
}

export async function loadInventoryPoStatusNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: PoStatusNotifyModuleId;
    limit?: number;
  },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const limit = params.limit ?? 5;
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const dismissed = await fetchDismissedEventIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
  });

  const { data, error } = await sb
    .from("notification_events")
    .select("id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.warn("[gwada] inventory po status bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const def = NOTIFICATION_MODULES[params.module];
  const rows = (data ?? []).filter((row) => {
    const r = row as {
      id: string;
      payload: Record<string, unknown> | null;
    };
    if (dismissed.has(r.id)) return false;
    return !shouldSkipNotificationForViewer(params.userId, r.payload);
  });

  const items = rows.slice(0, limit).map((row) => {
    const r = row as {
      id: string;
      payload: Record<string, unknown> | null;
      created_at: string;
    };
    const payload = r.payload ?? {};
    const supplier =
      typeof payload.supplierName === "string" && payload.supplierName.trim()
        ? payload.supplierName.trim()
        : "Lieferant";
    const lines = parsePoStatusLines(payload.lines);
    return {
      id: r.id,
      title: def.label,
      subtitle: formatPoStatusBellSubtitle({
        module: params.module,
        supplierName: supplier,
        deliveryDate: payload.deliveryDate,
        lines,
      }),
      href: def.href || APP_ROUTES.inventory.order,
      at: r.created_at,
      meta: { eventId: r.id },
    };
  });

  return { items, totalCount: rows.length };
}

export async function dismissInventoryPoStatusNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    eventId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_inventory_po_status_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        event_id: params.eventId,
      },
      { onConflict: "profile_id,restaurant_id,event_id" },
    );
  return { error: error?.message ?? null };
}

export async function dismissAllInventoryPoStatusNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: PoStatusNotifyModuleId;
  },
): Promise<{ error: string | null }> {
  const { items } = await loadInventoryPoStatusNotificationItems(sb, {
    ...params,
    limit: 80,
  });
  if (items.length === 0) return { error: null };

  const rows = items.map((item) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    event_id: item.id,
  }));
  const { error } = await sb
    .from("restaurant_inventory_po_status_dismissals")
    .upsert(rows, { onConflict: "profile_id,restaurant_id,event_id" });
  return { error: error?.message ?? null };
}
