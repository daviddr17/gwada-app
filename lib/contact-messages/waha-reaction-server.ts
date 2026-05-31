import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSetMessageReaction } from "@/lib/waha/waha-reaction";

export async function setWahaMessageReactionServer(params: {
  restaurantId: string;
  messageId: string;
  reaction: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigAdmin();
  if (!config) {
    return { ok: false, error: "waha_not_configured" };
  }

  const messageId = params.messageId.trim();
  if (!messageId) {
    return { ok: false, error: "invalid_request" };
  }

  return wahaSetMessageReaction({
    config,
    restaurantId: params.restaurantId,
    messageId,
    reaction: params.reaction,
  });
}
