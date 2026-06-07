import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export async function wahaSendText(params: {
  restaurantId: string;
  chatId: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigAdmin();
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

  return { ok: true };
}
