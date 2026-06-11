import type { NotificationChannelsInfo } from "@/lib/notifications/notification-channels-server";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationPreferences } from "@/lib/notifications/notification-preferences";
import type { NotificationSummary } from "@/lib/notifications/notification-types";

export type NotificationPreferencesResponse = {
  preferences: NotificationPreferences;
  channels: NotificationChannelsInfo;
};

export async function fetchNotificationSummaryClient(
  restaurantId: string,
): Promise<{ data: NotificationSummary | null; error: string | null }> {
  try {
    const q = new URLSearchParams({ restaurantId });
    const res = await fetch(`/api/notifications/summary?${q}`);
    const body = (await res.json()) as {
      data?: NotificationSummary;
      error?: string;
    };
    if (!res.ok) {
      return { data: null, error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? null, error: null };
  } catch {
    return { data: null, error: "network_error" };
  }
}

export async function markNotificationReadClient(params: {
  restaurantId: string;
  module: NotificationModuleId;
  itemId?: string | null;
  meta?: Record<string, string>;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function fetchNotificationPreferencesClient(
  restaurantId: string,
): Promise<{
  data: NotificationPreferencesResponse | null;
  error: string | null;
}> {
  try {
    const q = new URLSearchParams({ restaurantId });
    const res = await fetch(`/api/notifications/preferences?${q}`);
    const body = (await res.json()) as {
      data?: NotificationPreferencesResponse;
      error?: string;
    };
    if (!res.ok) {
      return { data: null, error: body.error ?? `http_${res.status}` };
    }
    return { data: body.data ?? null, error: null };
  } catch {
    return { data: null, error: "network_error" };
  }
}

export async function saveNotificationPreferencesClient(params: {
  restaurantId: string;
  preferences: NotificationPreferences;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      return { ok: false, error: body.error ?? `http_${res.status}` };
    }
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
