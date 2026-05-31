import "server-only";

import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

async function isWhatsappSessionWorking(restaurantId: string): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
}

export async function sendWahaMessageServer(params: {
  restaurantId: string;
  wahaContactId: string;
  body: string;
}): Promise<{ ok: boolean; errors: string[] }> {
  const text = params.body.trim();
  if (!text) return { ok: false, errors: ["empty_body"] };

  const chatId = wahaChatIdFromPseudoContactId(params.wahaContactId);
  if (!chatId) return { ok: false, errors: ["invalid_waha_contact"] };

  if (!(await isWhatsappSessionWorking(params.restaurantId))) {
    return { ok: false, errors: ["whatsapp:session_not_working"] };
  }

  const sent = await wahaSendText({
    restaurantId: params.restaurantId,
    chatId,
    text,
  });

  if (!sent.ok) {
    return { ok: false, errors: [`whatsapp:${sent.error}`] };
  }

  return { ok: true, errors: [] };
}
