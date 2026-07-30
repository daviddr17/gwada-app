import { parseWahaSendResponseMessageId } from "@/lib/contact-messages/outbound-whatsapp-db-server";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export async function wahaSendText(params: {
  restaurantId: string;
  chatId: string;
  text: string;
  /** WAHA: Link-Vorschau bei URLs (Standard aus — weniger Ballast bei Push/Systemnachrichten). */
  linkPreview?: boolean;
}): Promise<
  | { ok: true; wahaMessageId?: string | null }
  | { ok: false; error: string }
> {
  const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
  if (!config) {
    return { ok: false, error: "waha_not_configured" };
  }

  const session = wahaSessionNameForRestaurant(params.restaurantId);
  const url = `${config.baseUrl}/api/sendText`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({
        session,
        chatId: params.chatId,
        text: params.text,
        linkPreview: params.linkPreview ?? false,
      }),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: msg };
  }

  if (!res.ok) {
    let error = `waha_send_${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) error = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false, error };
  }

  let wahaMessageId: string | null = null;
  try {
    const body = await res.json();
    wahaMessageId = parseWahaSendResponseMessageId(body);
  } catch {
    /* leerer Body — Webhook verknüpft später */
  }

  return { ok: true, wahaMessageId };
}
