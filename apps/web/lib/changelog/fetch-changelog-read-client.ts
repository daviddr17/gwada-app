import { dispatchNotificationsRefresh } from "@/lib/notifications/notification-events";

export async function markAllChangelogReadClient(
  restaurantId: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/changelog/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      return { ok: false, error: json.error ?? "mark_all_read_failed" };
    }
    dispatchNotificationsRefresh();
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
