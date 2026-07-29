import "server-only";

import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type StatusKind = "image" | "video";

/**
 * WhatsApp Status (Story) via WAHA.
 * NOWEB: Store muss aktiv sein (Gwada setzt noweb.store.enabled bei Session-Create).
 * Ohne `contacts` → alle Kontakte (laut WAHA-Doku).
 */
export async function wahaSendStatusMedia(params: {
  restaurantId: string;
  kind: StatusKind;
  mediaUrl: string;
  mimeType?: string;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
  if (!config) return { ok: false, error: "waha_not_configured" };

  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const path =
    params.kind === "video"
      ? `/api/${encodeURIComponent(session)}/status/video`
      : `/api/${encodeURIComponent(session)}/status/image`;

  const mime =
    params.mimeType?.trim() ||
    (params.kind === "video" ? "video/mp4" : "image/jpeg");

  const body: Record<string, unknown> = {
    file: {
      mimetype: mime,
      url: params.mediaUrl,
    },
  };
  if (params.caption?.trim() && params.kind === "image") {
    body.caption = params.caption.trim();
  }

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      let error = `waha_status_${res.status}`;
      try {
        const parsed = (await res.json()) as { message?: string; error?: string };
        error = parsed.message ?? parsed.error ?? error;
      } catch {
        /* ignore */
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch_failed",
    };
  }
}
