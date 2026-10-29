import "server-only";

import { ingestInboundContactMessage } from "@/lib/contacts/ingest-inbound-contact-message";
import {
  attachmentKindFromImapMeta,
  persistEmailImapMessageAttachments,
} from "@/lib/contacts/persist-email-imap-message-attachments";
import { resolveOrCreateContactForEmailInbound } from "@/lib/contacts/resolve-or-create-inbound-contact-server";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { emailAddressFromPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import {
  fetchImapRecentEnvelopes,
  fetchImapThreadBodies,
  imapCounterpartyEmail,
  type ImapCredentials,
} from "@/lib/email/imap-inbox";
import {
  getGmailAccessTokenForUser,
  gmailCredentialsFromAccess,
} from "@/lib/integrations/gmail-email-access-personal";
import {
  getOutlookAccessTokenForUser,
  outlookCredentialsFromAccess,
} from "@/lib/integrations/outlook-email-access-personal";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import { fetchUserRestaurantEmailConfigAdmin } from "@/lib/supabase/user-restaurant-email-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

function personalExternalPrefix(userId: string): string {
  return `email-imap-personal:${userId}:`;
}

function personalExternalId(userId: string, uid: number): string {
  return `${personalExternalPrefix(userId)}${uid}`;
}

async function resolvePersonalImapCredentials(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<ImapCredentials | null> {
  const row = await fetchUserRestaurantEmailConfigAdmin(admin, params);
  if (!row) return null;
  if (row.status === "gmail") {
    const gmail = await getGmailAccessTokenForUser(params);
    if ("error" in gmail) return null;
    const email = gmail.config.email?.trim();
    if (!email) return null;
    return gmailCredentialsFromAccess(email, gmail.accessToken);
  }
  if (row.status === "outlook") {
    const outlook = await getOutlookAccessTokenForUser(params);
    if ("error" in outlook) return null;
    const email = outlook.config.email?.trim();
    if (!email) return null;
    return outlookCredentialsFromAccess(email, outlook.accessToken);
  }
  if (row.status === "custom") {
    return smtpCredentialsFromConfig(row.config);
  }
  return null;
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

/** Sync personal staff mailbox into private contact_messages rows. */
export async function syncUserRestaurantEmailInbox(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ imported: number; error: string | null }> {
  const creds = await resolvePersonalImapCredentials(admin, params);
  if (!creds) return { imported: 0, error: null };

  const contactByEmail = await emailToContactMap(admin, params.restaurantId);
  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error) return { imported: 0, error };

  const inboundByContact = new Map<string, number[]>();
  for (const env of envelopes) {
    if (env.outbound || env.seen) continue;
    const party = imapCounterpartyEmail(env, creds.email);
    if (!party) continue;
    let contactId = contactByEmail.get(party) ?? null;
    if (!contactId) {
      contactId = await resolveOrCreateContactForEmailInbound(admin, {
        restaurantId: params.restaurantId,
        email: party,
      });
      if (contactId) contactByEmail.set(party, contactId);
    }
    const threadKey = contactId ?? `email:${party}`;
    const list = inboundByContact.get(threadKey) ?? [];
    list.push(env.uid);
    inboundByContact.set(threadKey, list);
  }

  if (inboundByContact.size === 0) {
    return { imported: 0, error: null };
  }

  const prefix = personalExternalPrefix(params.userId);
  const allUids = [...inboundByContact.values()].flat();
  const { data: existing } = await admin
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("mailbox_owner_user_id", params.userId)
    .like("external_source_id", `${prefix}%`);

  const known = new Set(
    (existing ?? [])
      .map((r) => (r as { external_source_id: string }).external_source_id)
      .filter(Boolean),
  );

  const missingUids = allUids.filter(
    (uid) => !known.has(personalExternalId(params.userId, uid)),
  );
  if (missingUids.length === 0) return { imported: 0, error: null };

  const { bodies, error: bodyErr } = await fetchImapThreadBodies(
    creds,
    missingUids,
  );
  if (bodyErr) return { imported: 0, error: bodyErr };

  let imported = 0;
  for (const [threadKey, uids] of inboundByContact) {
    for (const uid of uids) {
      const externalSourceId = personalExternalId(params.userId, uid);
      if (known.has(externalSourceId)) continue;
      const parsed = bodies.get(uid);
      if (!parsed || parsed.outbound) continue;
      const meta = parsed.attachmentMeta ?? [];
      const body = parsed.body?.trim() ?? "";
      if (!body && meta.length === 0) continue;

      const result = await ingestInboundContactMessage(admin, {
        restaurantId: params.restaurantId,
        contactId: threadKey,
        platform: "email",
        direction: "inbound",
        body: body || " ",
        externalSourceId,
        externalSeen: false,
        mailboxOwnerUserId: params.userId,
        attachmentKind: attachmentKindFromImapMeta(meta),
        conversationLabel:
          emailAddressFromPseudoContactId(threadKey) ?? undefined,
        ...(parsed.date ? { createdAt: parsed.date.toISOString() } : {}),
      });

      if (result.messageId) {
        await persistEmailImapMessageAttachments(admin, {
          restaurantId: params.restaurantId,
          messageId: result.messageId,
          uid,
          attachments: meta,
        });
      }
      if (result.imported) {
        imported += 1;
        known.add(externalSourceId);
      }
    }
  }

  return { imported, error: null };
}
