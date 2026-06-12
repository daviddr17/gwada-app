import "server-only";

import { metaGraphGet } from "@/lib/contact-messages/meta-graph-client";
import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import { parseMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { SupabaseClient } from "@supabase/supabase-js";

type MetaParticipant = { id: string };
type MetaConversation = {
  id: string;
  participants?: { data?: MetaParticipant[] };
};

export async function resolveMetaConversationId(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
  },
): Promise<{ conversationId: string | null; error: string | null }> {
  const parsed = parseMetaPseudoContactId(params.contactId);
  if (!parsed) return { conversationId: null, error: "invalid_meta_contact" };

  const auth = await resolveMetaInboxAuth(
    admin,
    params.restaurantId,
    parsed.platform,
  );
  if (!auth) return { conversationId: null, error: "meta_not_connected" };

  const graphPlatform =
    parsed.platform === "instagram" ? "instagram" : "messenger";
  const rootId = parsed.platform === "instagram" ? auth.igUserId! : auth.pageId;

  const listQ = new URLSearchParams({
    access_token: auth.pageAccessToken,
    platform: graphPlatform,
    fields: "id,participants",
    limit: "50",
  });
  const listUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${rootId}/conversations?${listQ}`;
  const listRes = await metaGraphGet<{ data?: MetaConversation[] }>(listUrl);
  if (listRes.error) return { conversationId: null, error: listRes.error };

  const conversationId = (listRes.data?.data ?? []).find((conv) =>
    conv.participants?.data?.some((p) => p.id === parsed.senderId),
  )?.id;

  return { conversationId: conversationId ?? null, error: null };
}
