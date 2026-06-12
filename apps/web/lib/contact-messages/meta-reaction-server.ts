import "server-only";

import { metaGraphPostJson } from "@/lib/contact-messages/meta-graph-client";
import { emojiToMetaReactionType } from "@/lib/contact-messages/meta-message-map";
import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function setMetaMessageReactionServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: "facebook" | "instagram";
    messageId: string;
    reaction: string;
  },
): Promise<{ ok: boolean; error: string | null }> {
  const auth = await resolveMetaInboxAuth(
    admin,
    params.restaurantId,
    params.platform,
  );
  if (!auth) return { ok: false, error: "meta_not_connected" };

  const reactionValue = params.reaction.trim()
    ? emojiToMetaReactionType(params.reaction.trim())
    : "none";

  const res = await metaGraphPostJson<{ success?: boolean }>({
    path: `${params.messageId}/reactions`,
    accessToken: auth.pageAccessToken,
    body: { reaction: reactionValue },
  });

  if (res.error) return { ok: false, error: res.error };
  return { ok: true, error: null };
}
