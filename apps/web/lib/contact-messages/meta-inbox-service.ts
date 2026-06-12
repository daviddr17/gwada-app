import "server-only";

import { metaGraphGet } from "@/lib/contact-messages/meta-graph-client";
import {
  mapMetaGraphMessageToRow,
  type MetaGraphMessage,
} from "@/lib/contact-messages/meta-message-map";
import { resolveMetaConversationId } from "@/lib/contact-messages/meta-conversation-resolve";
import { resolveMetaInboxAuth } from "@/lib/contact-messages/meta-inbox-auth-server";
import { metaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { parseMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { metaScopeMissingMessage } from "@/lib/integrations/meta-graph-error-message";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import type { SupabaseClient } from "@supabase/supabase-js";

type MetaParticipant = { id: string; name?: string };
type MetaConversation = {
  id: string;
  updated_time?: string;
  snippet?: string;
  unread_count?: number;
  participants?: { data?: MetaParticipant[] };
  messages?: { data?: MetaGraphMessage[] };
};

function counterpartyFromConversation(
  conv: MetaConversation,
  ownIds: Set<string>,
): MetaParticipant | null {
  const parts = conv.participants?.data ?? [];
  for (const p of parts) {
    if (!ownIds.has(p.id)) return p;
  }
  return parts[0] ?? null;
}

function proxyMetaAttachmentUrl(params: {
  restaurantId: string;
  platform: "facebook" | "instagram";
  url: string;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    platform: params.platform,
    url: params.url,
  });
  return `/api/contact-messages/meta/media?${q}`;
}

function withProxiedAttachments(
  row: ContactMessageRow,
  params: {
    restaurantId: string;
    platform: "facebook" | "instagram";
  },
): ContactMessageRow {
  if (!row.attachments?.length) return row;
  const attachments: ContactMessageAttachment[] = row.attachments.map((a) => ({
    ...a,
    url: a.url.startsWith("/api/")
      ? a.url
      : proxyMetaAttachmentUrl({
          restaurantId: params.restaurantId,
          platform: params.platform,
          url: a.url,
        }),
  }));
  return { ...row, attachments };
}

export async function fetchMetaInboxConversations(
  admin: SupabaseClient,
  restaurantId: string,
  platform: "facebook" | "instagram",
): Promise<{ data: ContactConversationPreview[]; error: string | null }> {
  const auth = await resolveMetaInboxAuth(admin, restaurantId, platform);
  if (!auth) return { data: [], error: "meta_not_connected" };

  if (platform === "facebook" && auth.grantedScopes.length > 0) {
    if (!auth.grantedScopes.includes("pages_messaging")) {
      return {
        data: [],
        error: metaScopeMissingMessage({
          platform: "facebook",
          feature: "messages",
          scopeId: "pages_messaging",
          scopeLabel: "Messenger-Nachrichten",
        }),
      };
    }
  }
  if (platform === "instagram" && auth.grantedScopes.length > 0) {
    if (!auth.grantedScopes.includes("instagram_manage_messages")) {
      return {
        data: [],
        error: metaScopeMissingMessage({
          platform: "instagram",
          feature: "messages",
          scopeId: "instagram_manage_messages",
          scopeLabel: "Instagram Direct-Nachrichten",
        }),
      };
    }
  }

  const ownIds = new Set(
    [auth.pageId, auth.igUserId].filter((id): id is string => Boolean(id)),
  );
  const graphPlatform = platform === "instagram" ? "instagram" : "messenger";
  const rootId = platform === "instagram" ? auth.igUserId! : auth.pageId;

  const q = new URLSearchParams({
    access_token: auth.pageAccessToken,
    platform: graphPlatform,
    fields:
      "id,updated_time,snippet,unread_count,participants,messages.limit(1){id,message,from,created_time,attachments,sticker}",
    limit: "50",
  });
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${rootId}/conversations?${q}`;
  const { data, error } = await metaGraphGet<{ data?: MetaConversation[] }>(url, {
    platform,
    feature: "messages",
  });
  if (error) return { data: [], error };

  const previews: ContactConversationPreview[] = [];

  for (const conv of data?.data ?? []) {
    const party = counterpartyFromConversation(conv, ownIds);
    if (!party?.id) continue;

    const lastMsg = conv.messages?.data?.[0];
    const mapped = lastMsg
      ? mapMetaGraphMessageToRow({
          msg: lastMsg,
          restaurantId,
          contactId: metaPseudoContactId(platform, party.id),
          platform,
          ownIds,
        })
      : null;

    const lastAt =
      mapped?.created_at ??
      lastMsg?.created_time ??
      conv.updated_time ??
      new Date().toISOString();
    const lastBody = mapped?.body ?? lastMsg?.message ?? conv.snippet ?? "";
    const fromId = lastMsg?.from?.id ?? "";
    const inbound = fromId === party.id;
    const unread = conv.unread_count ?? 0;

    previews.push({
      contact_id: metaPseudoContactId(platform, party.id),
      contact_name:
        party.name?.trim() ||
        (platform === "instagram" ? "Instagram" : "Messenger"),
      platform,
      last_body: lastBody,
      last_at: lastAt,
      last_direction: inbound ? "inbound" : "outbound",
      message_count: 1,
      unread_count: unread,
      is_unread: unread > 0,
      has_reservation_link: false,
      inbound_since_preview: inbound ? 1 : 0,
      last_message_platform: platform,
      last_inbound_platform: inbound ? platform : undefined,
      last_attachment_kind: mapped?.attachments?.[0]?.kind,
    });
  }

  return { data: previews, error: null };
}

export async function fetchMetaThreadMessages(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
  },
): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  const parsed = parseMetaPseudoContactId(params.contactId);
  if (!parsed) return { data: [], error: "invalid_meta_contact" };

  const auth = await resolveMetaInboxAuth(
    admin,
    params.restaurantId,
    parsed.platform,
  );
  if (!auth) return { data: [], error: "meta_not_connected" };

  const ownIds = new Set(
    [auth.pageId, auth.igUserId].filter((id): id is string => Boolean(id)),
  );

  const { conversationId, error: convErr } = await resolveMetaConversationId(
    admin,
    params,
  );
  if (convErr) return { data: [], error: convErr };
  if (!conversationId) return { data: [], error: null };

  const msgQ = new URLSearchParams({
    access_token: auth.pageAccessToken,
    fields:
      "messages.limit(50){id,message,from,created_time,attachments,sticker,reactions}",
  });
  const msgUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${conversationId}?${msgQ}`;
  const msgRes = await metaGraphGet<MetaConversation>(msgUrl);
  if (msgRes.error) return { data: [], error: msgRes.error };

  const rows = (msgRes.data?.messages?.data ?? [])
    .map((m) =>
      mapMetaGraphMessageToRow({
        msg: m,
        restaurantId: params.restaurantId,
        contactId: params.contactId,
        platform: parsed.platform,
        ownIds,
      }),
    )
    .filter((r): r is ContactMessageRow => r != null)
    .map((r) =>
      withProxiedAttachments(r, {
        restaurantId: params.restaurantId,
        platform: parsed.platform,
      }),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return { data: rows, error: null };
}
