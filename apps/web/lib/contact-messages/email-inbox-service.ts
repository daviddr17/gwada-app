import "server-only";

import {
  fetchImapMessageSnippets,
  fetchImapRecentEnvelopes,
  fetchImapThreadBodies,
  imapCounterpartyEmail,
  imapSetMessagesSeen,
  type ImapCredentials,
  type ImapEnvelopeMessage,
} from "@/lib/email/imap-inbox";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { emailAddressFromPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { emailAttachmentProxyUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import { attachmentKindFromMime } from "@/lib/contact-messages/outbound-attachment-files";
import {
  fetchRestaurantEmailSmtpConfig,
} from "@/lib/supabase/restaurant-email-integration-db";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveRestaurantImapCredentials(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ImapCredentials | null> {
  const row = await fetchRestaurantEmailSmtpConfig(admin, restaurantId);
  if (!row || row.status !== "custom") return null;
  return smtpCredentialsFromConfig(row.config);
}

function buildEmailToContactMap(
  contacts: Record<string, unknown>[],
): Map<string, { id: string; name: string }> {
  const map = new Map<string, { id: string; name: string }>();
  for (const c of contacts) {
    const row = c as Record<string, unknown>;
    const id = row.id as string;
    const name = contactDisplayName({
      first_name: row.first_name as string,
      last_name: row.last_name as string,
    });
    const emails = row.contact_emails;
    const list = Array.isArray(emails) ? emails : [];
    for (const e of list) {
      const er = e as { email: string };
      const norm = normalizeContactEmail(er.email);
      if (norm) map.set(norm, { id, name });
    }
  }
  return map;
}

export async function fetchEmailInboxConversations(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ data: ContactConversationPreview[]; error: string | null }> {
  const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
  if (!creds) return { data: [], error: "imap_not_configured" };

  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error) return { data: [], error };

  const { data: contacts } = await admin
    .from("contacts")
    .select(
      `
      id,
      first_name,
      last_name,
      contact_emails ( email )
    `,
    )
    .eq("restaurant_id", restaurantId);

  const emailToContact = buildEmailToContactMap(
    (contacts ?? []) as Record<string, unknown>[],
  );

  const byKey = new Map<string, ContactConversationPreview>();

  for (const msg of envelopes) {
    const party = imapCounterpartyEmail(msg, creds.email);
    if (!party) continue;

    const matched = emailToContact.get(party);
    const key = matched?.id ?? `email:${party}`;
    const lastAt = msg.date.toISOString();
    const existing = byKey.get(key);
    const unseenInbound = !msg.outbound && !msg.seen;

    if (!existing) {
      byKey.set(key, {
        contact_id: key,
        contact_name: matched?.name ?? party,
        platform: "email",
        last_body: msg.snippet,
        last_at: lastAt,
        last_direction: msg.outbound ? "outbound" : "inbound",
        message_count: 1,
        unread_count: unseenInbound ? 1 : 0,
        is_unread: unseenInbound,
        has_reservation_link: false,
        inbound_since_preview: unseenInbound ? 1 : 0,
        email_unread_count: unseenInbound ? 1 : 0,
      });
      continue;
    }

    existing.message_count += 1;
    if (unseenInbound) {
      existing.unread_count += 1;
      existing.inbound_since_preview =
        (existing.inbound_since_preview ?? 0) + 1;
      existing.email_unread_count =
        (existing.email_unread_count ?? 0) + 1;
    }
    if (lastAt > existing.last_at) {
      existing.last_body = msg.snippet;
      existing.last_at = lastAt;
      existing.last_direction = msg.outbound ? "outbound" : "inbound";
      existing.last_attachment_kind = undefined;
    }
  }

  for (const preview of byKey.values()) {
    preview.is_unread = preview.unread_count > 0;
    preview.email_unread_count = preview.unread_count;
  }

  const latestUidByKey = new Map<string, number>();
  for (const msg of envelopes) {
    const party = imapCounterpartyEmail(msg, creds.email);
    if (!party) continue;
    const matched = emailToContact.get(party);
    const key = matched?.id ?? `email:${party}`;
    const lastAt = msg.date.toISOString();
    const prevUid = latestUidByKey.get(key);
    const prevPreview = byKey.get(key);
    if (!prevPreview || lastAt >= prevPreview.last_at) {
      latestUidByKey.set(key, msg.uid);
    }
  }

  const previewUids = [...latestUidByKey.values()];
  if (previewUids.length > 0) {
    const snippets = await fetchImapMessageSnippets(creds, previewUids);
    for (const [key, uid] of latestUidByKey) {
      const preview = byKey.get(key);
      const snippet = snippets.get(uid);
      if (preview && snippet) {
        preview.last_body = snippet.snippet;
        preview.last_attachment_kind = snippet.attachmentKind;
      }
    }
  }

  const list = [...byKey.values()].sort((a, b) =>
    b.last_at.localeCompare(a.last_at),
  );

  return { data: list, error: null };
}

async function contactEmailsForThread(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<string[]> {
  const pseudo = emailAddressFromPseudoContactId(contactId);
  if (pseudo) return [pseudo];

  const { data: rows } = await admin
    .from("contact_emails")
    .select("email")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId);

  const fromTable = (rows ?? [])
    .map((r) => normalizeContactEmail((r as { email: string }).email))
    .filter((e): e is string => Boolean(e));
  if (fromTable.length > 0) return fromTable;

  const { data: contact } = await admin
    .from("contacts")
    .select("contact_emails ( email )")
    .eq("restaurant_id", restaurantId)
    .eq("id", contactId)
    .maybeSingle();

  const nested = contact?.contact_emails;
  if (!Array.isArray(nested)) return [];

  return nested
    .map((e) => normalizeContactEmail((e as { email: string }).email))
    .filter((e): e is string => Boolean(e));
}

function messageMatchesContact(
  msg: ImapEnvelopeMessage,
  contactEmails: Set<string>,
  accountEmail: string,
): boolean {
  const account = accountEmail.toLowerCase();
  if (msg.from && contactEmails.has(msg.from)) return true;
  return msg.to.some((t) => contactEmails.has(t.toLowerCase()));
}

export async function fetchEmailInboxThread(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
  },
): Promise<{ data: ContactMessageRow[]; error: string | null }> {
  const creds = await resolveRestaurantImapCredentials(admin, params.restaurantId);
  if (!creds) return { data: [], error: "imap_not_configured" };

  const contactEmails = new Set(
    await contactEmailsForThread(admin, params.restaurantId, params.contactId),
  );
  if (contactEmails.size === 0) {
    return { data: [], error: "no_contact_email" };
  }

  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error) return { data: [], error };

  const threadEnvelopes = envelopes
    .filter((m) => messageMatchesContact(m, contactEmails, creds.email))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const uids = threadEnvelopes.map((m) => m.uid);
  const { bodies, error: bodyErr } = await fetchImapThreadBodies(creds, uids);
  if (bodyErr) return { data: [], error: bodyErr };

  const rows: ContactMessageRow[] = threadEnvelopes.map((env) => {
    const parsed = bodies.get(env.uid);
    const body = parsed?.body ?? env.subject;
    const outbound = parsed?.outbound ?? env.outbound;
    const attachments = (parsed?.attachmentMeta ?? []).map((a) => ({
      id: String(a.index),
      kind: attachmentKindFromMime(a.mimeType),
      fileName: a.fileName,
      mimeType: a.mimeType,
      byteSize: a.byteSize,
      url: emailAttachmentProxyUrl({
        restaurantId: params.restaurantId,
        uid: env.uid,
        index: a.index,
      }),
    }));
    return {
      id: `imap:${env.uid}`,
      restaurant_id: params.restaurantId,
      contact_id: params.contactId,
      platform: "email" as const,
      direction: outbound ? "outbound" : "inbound",
      body,
      body_html: parsed?.body_html ?? null,
      reservation_id: null,
      sent_by: null,
      delivery_status: "delivered",
      created_at: (parsed?.date ?? env.date).toISOString(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  });

  return { data: rows, error: null };
}

export async function threadEnvelopesForContact(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string },
  creds: ImapCredentials,
): Promise<{ envelopes: ImapEnvelopeMessage[]; error: string | null }> {
  const contactEmails = new Set(
    await contactEmailsForThread(admin, params.restaurantId, params.contactId),
  );
  if (contactEmails.size === 0) {
    return { envelopes: [], error: "no_contact_email" };
  }

  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error) return { envelopes: [], error };

  const thread = envelopes.filter((m) =>
    messageMatchesContact(m, contactEmails, creds.email),
  );
  return { envelopes: thread, error: null };
}

/** IMAP \\Seen für den ganzen Thread setzen (gelesen in Gwada = gelesen im Postfach). */
export async function syncEmailThreadSeenOnImap(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    seen: boolean;
  },
): Promise<{ error: string | null }> {
  const creds = await resolveRestaurantImapCredentials(admin, params.restaurantId);
  if (!creds) return { error: "imap_not_configured" };

  const { envelopes, error } = await threadEnvelopesForContact(
    admin,
    params,
    creds,
  );
  if (error) return { error };

  if (params.seen) {
    const uids = envelopes.map((m) => m.uid);
    return imapSetMessagesSeen(creds, uids, true);
  }

  const latestInbound = envelopes
    .filter((m) => !m.outbound)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  if (!latestInbound) return { error: null };
  return imapSetMessagesSeen(creds, [latestInbound.uid], false);
}
