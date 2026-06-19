import "server-only";

import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { emailAddressFromPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import {
  syncContactWhatsappInbound,
  syncPseudoWhatsappThread,
} from "@/lib/contacts/sync-contact-whatsapp-inbound";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import {
  fetchImapRecentEnvelopes,
  fetchImapThreadBodies,
  imapCounterpartyEmail,
} from "@/lib/email/imap-inbox";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Beim Verbinden unter Integrationen: letzte N Chats je Kanal in die DB. */
export const INBOX_CONNECT_HISTORY_THREAD_LIMIT = 10;

/** Pro WA-Chat: neueste Nachrichten mitspiegeln (nicht ganzer Verlauf). */
const WHATSAPP_MESSAGES_PER_THREAD_ON_CONNECT = 30;

const EXTERNAL_PREFIX = "email-imap:";

function externalIdForUid(uid: number): string {
  return `${EXTERNAL_PREFIX}${uid}`;
}

function threadKeyForEnvelope(
  party: string,
  contactByEmail: Map<string, string>,
): string {
  const contactId = contactByEmail.get(party) ?? null;
  return contactId ?? `email:${party}`;
}

async function emailToContactMap(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<Map<string, string>> {
  const { data: contacts } = await admin
    .from("contacts")
    .select(
      `
      id,
      contact_emails ( email )
    `,
    )
    .eq("restaurant_id", restaurantId);

  const map = new Map<string, string>();
  for (const c of contacts ?? []) {
    const row = c as Record<string, unknown>;
    const contactId = row.id as string;
    const emails = row.contact_emails;
    const list = Array.isArray(emails) ? emails : [];
    for (const e of list) {
      const norm = normalizeContactEmail((e as { email: string }).email);
      if (norm) map.set(norm, contactId);
    }
  }
  return map;
}

async function syncWhatsappInboxHistoryOnConnect(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const conv = await fetchWahaInboxConversations(admin, restaurantId, {
    skipDisplayNameResolve: true,
    overviewLimit: INBOX_CONNECT_HISTORY_THREAD_LIMIT,
  });
  if (conv.error) return 0;

  let imported = 0;
  for (const preview of conv.data.slice(0, INBOX_CONNECT_HISTORY_THREAD_LIMIT)) {
    const threadKey = preview.contact_id;
    if (!threadKey || threadKey.startsWith("email:")) continue;

    const result = isWahaPseudoContactId(threadKey)
      ? await syncPseudoWhatsappThread(admin, {
          restaurantId,
          conversationKey: threadKey,
          maxMessages: WHATSAPP_MESSAGES_PER_THREAD_ON_CONNECT,
          conversationLabel: preview.contact_name,
          silent: true,
        })
      : await syncContactWhatsappInbound(admin, {
          restaurantId,
          contactId: threadKey,
          maxMessages: WHATSAPP_MESSAGES_PER_THREAD_ON_CONNECT,
          silent: true,
        });

    imported += result.imported;
  }

  return imported;
}

async function syncEmailInboxHistoryOnConnect(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
  if (!creds) return 0;

  const contactByEmail = await emailToContactMap(admin, restaurantId);
  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error || envelopes.length === 0) return 0;

  const latestByThread = new Map<
    string,
    { threadKey: string; lastAt: number }
  >();

  for (const env of envelopes) {
    const party = imapCounterpartyEmail(env, creds.email);
    if (!party) continue;
    const threadKey = threadKeyForEnvelope(party, contactByEmail);
    const ts = env.date.getTime();
    const existing = latestByThread.get(threadKey);
    if (!existing || ts > existing.lastAt) {
      latestByThread.set(threadKey, { threadKey, lastAt: ts });
    }
  }

  const topThreadKeys = new Set(
    [...latestByThread.values()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .slice(0, INBOX_CONNECT_HISTORY_THREAD_LIMIT)
      .map((t) => t.threadKey),
  );

  if (topThreadKeys.size === 0) return 0;

  const envelopesForTopThreads = envelopes.filter((env) => {
    const party = imapCounterpartyEmail(env, creds.email);
    if (!party) return false;
    const threadKey = threadKeyForEnvelope(party, contactByEmail);
    return topThreadKeys.has(threadKey);
  });

  if (envelopesForTopThreads.length === 0) return 0;

  const uids = envelopesForTopThreads.map((e) => e.uid);
  const { data: existingRows } = await admin
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", restaurantId)
    .in(
      "external_source_id",
      uids.map((uid) => externalIdForUid(uid)),
    );

  const known = new Set(
    (existingRows ?? [])
      .map((r) => (r as { external_source_id: string }).external_source_id)
      .filter(Boolean),
  );

  const missingUids = uids.filter((uid) => !known.has(externalIdForUid(uid)));
  if (missingUids.length === 0) return 0;

  const { bodies, error: bodyErr } = await fetchImapThreadBodies(
    creds,
    missingUids,
  );
  if (bodyErr) return 0;

  let imported = 0;
  for (const env of envelopesForTopThreads) {
    const extId = externalIdForUid(env.uid);
    if (known.has(extId)) continue;

    const party = imapCounterpartyEmail(env, creds.email);
    if (!party) continue;
    const threadKey = threadKeyForEnvelope(party, contactByEmail);

    const parsed = bodies.get(env.uid);
    const body = parsed?.body?.trim() || env.snippet?.trim();
    if (!body) continue;

    const result = await insertContactMessageIfNew(admin, {
      restaurantId,
      contactId: threadKey,
      platform: "email",
      direction: env.outbound ? "outbound" : "inbound",
      body,
      externalSourceId: extId,
      createdAt: env.date.toISOString(),
      conversationLabel: emailAddressFromPseudoContactId(threadKey) ?? undefined,
      suppressNotifications: env.outbound ? false : true,
    });
    if (result.inserted) {
      imported += 1;
      known.add(extId);
    }
  }

  return imported;
}

/**
 * Nach erfolgreichem Verbinden (Integrationen): letzte Chats je Kanal in contact_messages.
 * Kein notification_events — historischer Import.
 */
export async function syncInboxHistoryOnConnect(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    whatsapp?: boolean;
    email?: boolean;
  },
): Promise<{
  whatsappImported: number;
  emailImported: number;
  error: string | null;
}> {
  const [whatsappImported, emailImported] = await Promise.all([
    params.whatsapp
      ? syncWhatsappInboxHistoryOnConnect(admin, params.restaurantId)
      : Promise.resolve(0),
    params.email
      ? syncEmailInboxHistoryOnConnect(admin, params.restaurantId)
      : Promise.resolve(0),
  ]);

  if (whatsappImported + emailImported > 0) {
    console.info(
      `[contact-inbox] history-on-connect ${params.restaurantId.slice(0, 8)}… wa=${whatsappImported} em=${emailImported}`,
    );
  }

  return { whatsappImported, emailImported, error: null };
}
