import "server-only";

import {
  fetchMetaInboxConversations,
  fetchMetaThreadMessages,
} from "@/lib/contact-messages/meta-inbox-service";
import { isMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { parseMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
import { resolveContactIdByMetaSender } from "@/lib/contact-messages/resolve-meta-sender-server";
import { sanitizeConversationLabelForStorage } from "@/lib/contact-messages/waha-chat-label";
import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import {
  META_CONNECT_HISTORY_THREAD_LIMIT,
  META_DAILY_SYNC_THREAD_LIMIT,
  META_MESSAGES_PER_THREAD,
} from "@/lib/contacts/meta-inbox-sync-limits";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  META_CONNECT_HISTORY_THREAD_LIMIT,
  META_DAILY_SYNC_THREAD_LIMIT,
  META_MESSAGES_PER_THREAD,
} from "@/lib/contacts/meta-inbox-sync-limits";

async function persistMetaConversationLabel(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversationKey: string;
    label: string | null | undefined;
  },
): Promise<void> {
  const label = sanitizeConversationLabelForStorage(params.label);
  if (!label || !isMetaPseudoContactId(params.conversationKey)) return;

  const { data: rows, error: selectError } = await admin
    .from("contact_messages")
    .select("id, conversation_label")
    .eq("restaurant_id", params.restaurantId)
    .eq("conversation_key", params.conversationKey)
    .limit(100);

  if (selectError) {
    console.warn("[meta-inbox] select conversation_label", selectError.message);
    return;
  }

  const ids = (rows ?? [])
    .filter((row) => {
      const current = (row.conversation_label as string | null)?.trim() ?? "";
      return !current || current !== label;
    })
    .map((row) => row.id as string);

  if (ids.length === 0) return;

  const { error } = await admin
    .from("contact_messages")
    .update({ conversation_label: label })
    .eq("restaurant_id", params.restaurantId)
    .in("id", ids);

  if (error) {
    console.warn("[meta-inbox] persist conversation_label", error.message);
  }
}

async function threadKeyForMetaSender(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: "facebook" | "instagram";
    senderId: string;
  },
): Promise<string> {
  const linked = await resolveContactIdByMetaSender(admin, {
    restaurantId: params.restaurantId,
    platform: params.platform,
    senderId: params.senderId,
  });
  if (linked) return linked;
  return `meta:${params.platform}:${params.senderId}`;
}

/**
 * Eine Meta-Conversation (FB/IG) in contact_messages spiegeln.
 * Idempotent über external_source_id `meta:{platform}:{mid}`.
 */
export async function syncMetaThreadMessages(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    /** Pseudo `meta:…` oder verknüpfte Kontakt-UUID. */
    threadKey: string;
    platform: "facebook" | "instagram";
    senderId: string;
    maxMessages?: number;
    conversationLabel?: string | null;
    /** Historie / Cron: keine notification_events. */
    silent?: boolean;
  },
): Promise<{ imported: number; error: string | null }> {
  const pseudoKey = `meta:${params.platform}:${params.senderId}`;
  const graphContactId = isMetaPseudoContactId(params.threadKey)
    ? params.threadKey
    : pseudoKey;

  const { data: messages, error } = await fetchMetaThreadMessages(admin, {
    restaurantId: params.restaurantId,
    contactId: graphContactId,
    limit: params.maxMessages ?? META_MESSAGES_PER_THREAD,
  });

  if (error) return { imported: 0, error };
  if (messages.length === 0) return { imported: 0, error: null };

  const label = sanitizeConversationLabelForStorage(params.conversationLabel);
  let imported = 0;

  for (const m of messages) {
    // mapMetaGraphMessageToRow: meta_message_id / external_source_id = rohe Graph-mid.
    const graphMid =
      m.meta_message_id?.trim() || m.external_source_id?.trim() || "";
    if (!graphMid || graphMid.startsWith("meta:")) continue;
    const externalSourceId = `meta:${params.platform}:${graphMid}`;
    const body = m.body.trim() || " ";
    if (!body.trim()) continue;

    const result = await insertContactMessageIfNew(admin, {
      restaurantId: params.restaurantId,
      contactId: params.threadKey,
      platform: params.platform,
      direction: m.direction,
      body,
      externalSourceId,
      createdAt: m.created_at,
      deliveryStatus: m.delivery_status ?? "delivered",
      conversationLabel: label,
      suppressNotifications: params.silent !== false,
    });
    if (result.inserted) imported += 1;
  }

  if (label && isMetaPseudoContactId(params.threadKey)) {
    await persistMetaConversationLabel(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.threadKey,
      label,
    });
  }

  return { imported, error: null };
}

export async function syncRestaurantMetaPlatformInbox(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: "facebook" | "instagram";
    threadLimit?: number;
    messagesPerThread?: number;
    silent?: boolean;
  },
): Promise<{ imported: number; error: string | null }> {
  const threadLimit = params.threadLimit ?? META_DAILY_SYNC_THREAD_LIMIT;
  const messagesPerThread =
    params.messagesPerThread ?? META_MESSAGES_PER_THREAD;

  const conv = await fetchMetaInboxConversations(
    admin,
    params.restaurantId,
    params.platform,
  );
  if (conv.error) {
    // Nicht verbunden / fehlende Scopes → kein Cron-Fehler.
    if (
      conv.error === "meta_not_connected" ||
      conv.error.includes("scope") ||
      conv.error.includes("pages_messaging") ||
      conv.error.includes("instagram_manage_messages")
    ) {
      return { imported: 0, error: null };
    }
    return { imported: 0, error: conv.error };
  }

  let imported = 0;
  for (const preview of conv.data.slice(0, threadLimit)) {
    const parsed = parseMetaPseudoContactId(preview.contact_id);
    if (!parsed || parsed.platform !== params.platform) continue;

    const threadKey = await threadKeyForMetaSender(admin, {
      restaurantId: params.restaurantId,
      platform: params.platform,
      senderId: parsed.senderId,
    });

    const result = await syncMetaThreadMessages(admin, {
      restaurantId: params.restaurantId,
      threadKey,
      platform: params.platform,
      senderId: parsed.senderId,
      maxMessages: messagesPerThread,
      conversationLabel: preview.contact_name,
      silent: params.silent !== false,
    });
    if (result.error) {
      return { imported, error: result.error };
    }
    imported += result.imported;
  }

  return { imported, error: null };
}

/** FB + IG für ein Restaurant (Connect-Historie oder täglicher Reconcile). */
export async function syncRestaurantMetaInbox(
  admin: SupabaseClient,
  restaurantId: string,
  options?: {
    platforms?: Array<"facebook" | "instagram">;
    threadLimit?: number;
    messagesPerThread?: number;
    silent?: boolean;
  },
): Promise<{
  facebookImported: number;
  instagramImported: number;
  error: string | null;
}> {
  const platforms = options?.platforms ?? ["facebook", "instagram"];
  let facebookImported = 0;
  let instagramImported = 0;
  const errors: string[] = [];

  for (const platform of platforms) {
    const result = await syncRestaurantMetaPlatformInbox(admin, {
      restaurantId,
      platform,
      threadLimit: options?.threadLimit,
      messagesPerThread: options?.messagesPerThread,
      silent: options?.silent,
    });
    if (platform === "facebook") facebookImported = result.imported;
    else instagramImported = result.imported;
    if (result.error) errors.push(`${platform}:${result.error}`);
  }

  return {
    facebookImported,
    instagramImported,
    error: errors.length ? errors.join("; ") : null,
  };
}
