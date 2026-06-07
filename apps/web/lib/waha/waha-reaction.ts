import type { WahaServerConfig } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

type WahaReactionResult =
  | { ok: true }
  | { ok: false; error: string };

async function wahaJsonPut(
  config: WahaServerConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<WahaReactionResult> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      let error = `waha_${res.status}`;
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
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }
}

/** Emoji setzen; leerer String entfernt die eigene Reaction (WAHA PUT /api/reaction). */
export async function wahaSetMessageReaction(params: {
  config: WahaServerConfig;
  restaurantId: string;
  messageId: string;
  reaction: string;
}): Promise<WahaReactionResult> {
  const session = wahaSessionNameForRestaurant(params.restaurantId);
  return wahaJsonPut(params.config, "/api/reaction", {
    session,
    messageId: params.messageId.trim(),
    reaction: params.reaction,
  });
}
