"use client";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { RestaurantChannelConnectionsPayload } from "@/lib/contact-messages/restaurant-channel-connections-types";
import { writeChannelConnectionsCache } from "@/lib/contact-messages/channel-connections-cache";
import { setUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { markConversationReadClient } from "@/lib/contact-messages/fetch-inbox-client";
import type { InboxPlatformFilter } from "@/lib/constants/contact-message-platforms";
import { INBOX_FILTER_ALL } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

type InboxApiResponse = {
  data?: {
    conversations: ContactConversationPreview[];
    channels: RestaurantChannelConnectionsPayload;
  };
  error?: string;
};

async function fetchInboxFromServer(params: {
  restaurantId: string;
  platform?: ContactMessagePlatform;
}): Promise<{
  data: ContactConversationPreview[];
  channels: RestaurantChannelConnectionsPayload | null;
  error: Error | null;
}> {
  const search = new URLSearchParams({ restaurantId: params.restaurantId });
  if (params.platform) search.set("platform", params.platform);

  const res = await fetch(`/api/contact-messages/inbox?${search.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as InboxApiResponse;
  if (!res.ok) {
    const message =
      body.error === "forbidden"
        ? "Keine Berechtigung für Nachrichten."
        : body.error ?? "Posteingang konnte nicht geladen werden.";
    return { data: [], channels: null, error: new Error(message) };
  }

  const conversations = body.data?.conversations ?? [];
  const channels = body.data?.channels ?? null;
  return { data: conversations, channels, error: null };
}

/** Posteingang — ein HTTP-Call statt vieler Browser-Supabase-Queries. */
export async function fetchUnifiedInboxConversations(params: {
  restaurantId: string;
  /** @deprecated Server löst Kanäle selbst auf — nur noch für Call-Site-Kompatibilität. */
  whatsappConnected?: boolean;
  emailConnected?: boolean;
  facebookConnected?: boolean;
  instagramConnected?: boolean;
}): Promise<{
  data: ContactConversationPreview[];
  channels: RestaurantChannelConnectionsPayload | null;
  error: Error | null;
}> {
  const { data, channels, error } = await fetchInboxFromServer({
    restaurantId: params.restaurantId,
  });
  if (error) return { data: [], channels: null, error };
  if (channels) {
    writeChannelConnectionsCache(params.restaurantId, channels);
  }
  setUnifiedInboxCache(params.restaurantId, data, { complete: true });
  return { data, channels, error: null };
}

export async function fetchInboxConversationsForPlatform(params: {
  restaurantId: string;
  platform: ContactMessagePlatform;
}): Promise<{ data: ContactConversationPreview[]; error: Error | null }> {
  const { data, error } = await fetchInboxFromServer({
    restaurantId: params.restaurantId,
    platform: params.platform,
  });
  return { data, error };
}

export async function markUnifiedInboxConversationReadClient(params: {
  restaurantId: string;
  contactId: string;
  whatsappConnected?: boolean;
  emailConnected?: boolean;
}): Promise<{ ok: boolean; error: string | null }> {
  return markConversationReadClient({
    restaurantId: params.restaurantId,
    conversationKey: params.contactId,
    platform: "gwada",
  });
}

export function isUnifiedInboxFilter(filter: InboxPlatformFilter): boolean {
  return filter === INBOX_FILTER_ALL;
}
