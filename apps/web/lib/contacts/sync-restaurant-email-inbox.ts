import "server-only";

import { insertContactMessageIfNew } from "@/lib/contacts/contact-inbound-message-insert";
import { resolveOrCreateContactForEmailInbound } from "@/lib/contacts/resolve-or-create-inbound-contact-server";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import {
  fetchImapRecentEnvelopes,
  fetchImapThreadBodies,
  imapCounterpartyEmail,
} from "@/lib/email/imap-inbox";
import type { SupabaseClient } from "@supabase/supabase-js";

const EXTERNAL_PREFIX = "email-imap:";

function externalIdForUid(uid: number): string {
  return `${EXTERNAL_PREFIX}${uid}`;
}

/** Hintergrund-Sync: nur ungelesene IMAP-Nachrichten importieren (kein historischer Unread-Bulk). */
function shouldImportEnvelopeInBackgroundSync(env: {
  outbound: boolean;
  seen: boolean;
}): boolean {
  if (env.outbound) return false;
  return !env.seen;
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

/** Ein IMAP-Durchlauf pro Restaurant — eingehende Mails bekannten Kontakten zuordnen. */
export async function syncRestaurantEmailInbox(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ imported: number; error: string | null }> {
  const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
  if (!creds) return { imported: 0, error: null };

  const contactByEmail = await emailToContactMap(admin, restaurantId);

  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error) return { imported: 0, error };

  const inboundByContact = new Map<string, number[]>();
  for (const env of envelopes) {
    if (!shouldImportEnvelopeInBackgroundSync(env)) continue;
    const party = imapCounterpartyEmail(env, creds.email);
    if (!party) continue;
    let contactId = contactByEmail.get(party) ?? null;
    if (!contactId) {
      contactId = await resolveOrCreateContactForEmailInbound(admin, {
        restaurantId,
        email: party,
      });
      if (contactId) contactByEmail.set(party, contactId);
    }
    if (!contactId) continue;
    const list = inboundByContact.get(contactId) ?? [];
    list.push(env.uid);
    inboundByContact.set(contactId, list);
  }

  if (inboundByContact.size === 0) return { imported: 0, error: null };

  const allUids = [...inboundByContact.values()].flat();
  const { data: existing } = await admin
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", restaurantId)
    .like("external_source_id", `${EXTERNAL_PREFIX}%`);

  const known = new Set(
    (existing ?? [])
      .map((r) => (r as { external_source_id: string }).external_source_id)
      .filter(Boolean),
  );

  const missingUids = allUids.filter((uid) => !known.has(externalIdForUid(uid)));
  if (missingUids.length === 0) return { imported: 0, error: null };

  const { bodies, error: bodyErr } = await fetchImapThreadBodies(
    creds,
    missingUids,
  );
  if (bodyErr) return { imported: 0, error: bodyErr };

  let imported = 0;
  for (const [contactId, uids] of inboundByContact) {
    for (const uid of uids) {
      if (known.has(externalIdForUid(uid))) continue;
      const parsed = bodies.get(uid);
      if (!parsed || parsed.outbound) continue;
      const body = parsed.body?.trim();
      if (!body) continue;

      const inserted = await insertContactMessageIfNew(admin, {
        restaurantId,
        contactId,
        platform: "email",
        direction: "inbound",
        body,
        externalSourceId: externalIdForUid(uid),
      });
      if (inserted) {
        imported += 1;
        known.add(externalIdForUid(uid));
      }
    }
  }

  if (imported > 0) {
    console.info(
      `[contact-inbox] email ${restaurantId.slice(0, 8)}… +${imported}`,
    );
  }

  return { imported, error: null };
}

/** Nur ein Kontakt (z. B. beim Öffnen des Threads). */
export async function syncContactEmailInbox(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string },
): Promise<{ imported: number; error: string | null }> {
  const creds = await resolveRestaurantImapCredentials(admin, params.restaurantId);
  if (!creds) return { imported: 0, error: null };

  const { data: rows } = await admin
    .from("contact_emails")
    .select("email")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId);

  const emails = new Set<string>();
  for (const row of rows ?? []) {
    const norm = normalizeContactEmail((row as { email: string }).email);
    if (norm) emails.add(norm);
  }
  if (emails.size === 0) return { imported: 0, error: "no_contact_email" };

  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error) return { imported: 0, error };

  const inboundUids: number[] = [];
  for (const env of envelopes) {
    if (env.outbound) continue;
    const party = imapCounterpartyEmail(env, creds.email);
    if (!party || !emails.has(party)) continue;
    inboundUids.push(env.uid);
  }

  if (inboundUids.length === 0) return { imported: 0, error: null };

  const { data: existing } = await admin
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .like("external_source_id", `${EXTERNAL_PREFIX}%`);

  const known = new Set(
    (existing ?? [])
      .map((r) => (r as { external_source_id: string }).external_source_id)
      .filter(Boolean),
  );

  const missing = inboundUids.filter((uid) => !known.has(externalIdForUid(uid)));
  if (missing.length === 0) return { imported: 0, error: null };

  const { bodies, error: bodyErr } = await fetchImapThreadBodies(creds, missing);
  if (bodyErr) return { imported: 0, error: bodyErr };

  let imported = 0;
  for (const uid of missing) {
    const parsed = bodies.get(uid);
    if (!parsed || parsed.outbound) continue;
    const body = parsed.body?.trim();
    if (!body) continue;

    const inserted = await insertContactMessageIfNew(admin, {
      restaurantId: params.restaurantId,
      contactId: params.contactId,
      platform: "email",
      direction: "inbound",
      body,
      externalSourceId: externalIdForUid(uid),
    });
    if (inserted) imported += 1;
  }

  return { imported, error: null };
}
