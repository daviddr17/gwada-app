import "server-only";

import type { UnifiedContactListRow } from "@/lib/contacts/unified-contact-row";
import { unifiedContactDisplayName } from "@/lib/contacts/unified-contact-row";
import {
  extractLexofficeEmails,
  extractLexofficePhones,
  lexofficeContactIdentityKeys,
  lexofficeContactNameParts,
  lexofficeContactPrimaryAddress,
  type LexofficeContact,
} from "@/lib/integrations/lexoffice-contacts";
import {
  emailsForCell,
  phonesForCell,
  type ContactListRow,
} from "@/lib/supabase/contacts-db";
import type { ContactLexofficeLinkRow } from "@/lib/supabase/contact-lexoffice-links-db";

function gwadaRowToUnified(row: ContactListRow): UnifiedContactListRow {
  return {
    rowKey: `gwada:${row.id}`,
    gwadaContactId: row.id,
    lexofficeContactId: null,
    platforms: ["gwada"],
    isMerged: false,
    first_name: row.first_name,
    last_name: row.last_name,
    company: row.company,
    address_street: row.address_street,
    address_postal_code: row.address_postal_code,
    address_city: row.address_city,
    address_country: row.address_country,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_interaction_at: row.last_interaction_at,
    emails: emailsForCell(row),
    phones: phonesForCell(row),
    reservation_count: row.reservation_count,
    message_count: row.message_count,
    tags: row.tags,
    lexoffice_customer_number: null,
  };
}

function lexofficeRowToUnified(contact: LexofficeContact): UnifiedContactListRow {
  const { firstName, lastName, company } = lexofficeContactNameParts(contact);
  const addr = lexofficeContactPrimaryAddress(contact);
  return {
    rowKey: `lexoffice:${contact.id}`,
    gwadaContactId: null,
    lexofficeContactId: contact.id,
    platforms: ["lexoffice"],
    isMerged: false,
    first_name: firstName || "—",
    last_name: lastName,
    company,
    address_street: addr?.street ?? null,
    address_postal_code: addr?.zip ?? null,
    address_city: addr?.city ?? null,
    address_country: addr?.countryCode ?? null,
    notes: contact.note ?? null,
    created_at: null,
    updated_at: null,
    last_interaction_at: null,
    emails: extractLexofficeEmails(contact),
    phones: extractLexofficePhones(contact),
    reservation_count: 0,
    message_count: 0,
    tags: [],
    lexoffice_customer_number: contact.roles?.customer?.number ?? null,
  };
}

function mergeGwadaLexoffice(
  gwada: UnifiedContactListRow,
  lexoffice: UnifiedContactListRow,
): UnifiedContactListRow {
  const emailSet = new Set([...gwada.emails, ...lexoffice.emails]);
  const phoneSet = new Set([...gwada.phones, ...lexoffice.phones]);
  return {
    ...gwada,
    rowKey: `merged:${gwada.gwadaContactId}:${lexoffice.lexofficeContactId}`,
    lexofficeContactId: lexoffice.lexofficeContactId,
    platforms: ["gwada", "lexoffice"],
    isMerged: true,
    emails: [...emailSet],
    phones: [...phoneSet],
    lexoffice_customer_number: lexoffice.lexoffice_customer_number,
    company: gwada.company ?? lexoffice.company,
    address_street: gwada.address_street ?? lexoffice.address_street,
    address_postal_code:
      gwada.address_postal_code ?? lexoffice.address_postal_code,
    address_city: gwada.address_city ?? lexoffice.address_city,
    address_country: gwada.address_country ?? lexoffice.address_country,
    notes: gwada.notes ?? lexoffice.notes,
    tags: gwada.tags,
  };
}

export function buildUnifiedContactList(params: {
  gwadaRows: ContactListRow[];
  lexofficeContacts: LexofficeContact[];
  links: ContactLexofficeLinkRow[];
}): UnifiedContactListRow[] {
  const gwadaById = new Map(
    params.gwadaRows.map((r) => [r.id, gwadaRowToUnified(r)]),
  );
  const lexById = new Map(
    params.lexofficeContacts.map((c) => [c.id, lexofficeRowToUnified(c)]),
  );

  const mergedGwada = new Set<string>();
  const mergedLex = new Set<string>();
  const out: UnifiedContactListRow[] = [];

  for (const link of params.links) {
    const gwada = gwadaById.get(link.contact_id);
    const lex = lexById.get(link.lexoffice_contact_id);
    if (!gwada || !lex) continue;
    out.push(mergeGwadaLexoffice(gwada, lex));
    mergedGwada.add(link.contact_id);
    mergedLex.add(link.lexoffice_contact_id);
  }

  const remainingGwada = [...gwadaById.entries()]
    .filter(([id]) => !mergedGwada.has(id))
    .map(([, row]) => row);
  const remainingLex = [...lexById.entries()]
    .filter(([id]) => !mergedLex.has(id))
    .map(([c, row]) => ({ contact: c, row }));

  const lexItems = remainingLex.map((item) => ({
    key: item.contact,
    row: item.row,
    identity: lexofficeContactIdentityKeys(
      params.lexofficeContacts.find((c) => c.id === item.contact)!,
    ),
  }));

  const lexEmailIndex = new Map<string, typeof lexItems>();
  const lexPhoneIndex = new Map<string, typeof lexItems>();
  for (const item of lexItems) {
    for (const e of item.identity.emails) {
      const bucket = lexEmailIndex.get(e) ?? [];
      bucket.push(item);
      lexEmailIndex.set(e, bucket);
    }
    for (const p of item.identity.phones) {
      const bucket = lexPhoneIndex.get(p) ?? [];
      bucket.push(item);
      lexPhoneIndex.set(p, bucket);
    }
  }

  for (const gwada of remainingGwada) {
    let matchedLex: (typeof lexItems)[number] | null = null;

    for (const email of gwada.emails) {
      const norm = email.trim().toLowerCase();
      const hits = lexEmailIndex.get(norm);
      if (hits?.[0]) {
        matchedLex = hits[0];
        break;
      }
    }
    if (!matchedLex) {
      for (const phone of gwada.phones) {
        const norm = phone.replace(/\D/g, "").replace(/^0+/, "");
        const hits = lexPhoneIndex.get(norm);
        if (hits?.[0]) {
          matchedLex = hits[0];
          break;
        }
      }
    }

    if (matchedLex && !mergedLex.has(matchedLex.key)) {
      out.push(mergeGwadaLexoffice(gwada, matchedLex.row));
      mergedLex.add(matchedLex.key);
    } else {
      out.push(gwada);
    }
  }

  for (const item of lexItems) {
    if (!mergedLex.has(item.key)) {
      out.push(item.row);
    }
  }

  out.sort((a, b) => {
    const ta = a.last_interaction_at
      ? new Date(a.last_interaction_at).getTime()
      : 0;
    const tb = b.last_interaction_at
      ? new Date(b.last_interaction_at).getTime()
      : 0;
    if (tb !== ta) return tb - ta;
    return unifiedContactDisplayName(a).localeCompare(
      unifiedContactDisplayName(b),
      "de",
    );
  });

  return out;
}

export function findLexofficeContactByIdentity(
  contacts: LexofficeContact[],
  emails: string[],
  phones: string[],
): LexofficeContact | null {
  const emailNorms = new Set(
    emails.map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  const phoneNorms = new Set(
    phones.map((p) => p.replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean),
  );

  for (const contact of contacts) {
    const keys = lexofficeContactIdentityKeys(contact);
    if (keys.emails.some((e) => emailNorms.has(e))) return contact;
    if (keys.phones.some((p) => phoneNorms.has(p))) return contact;
  }
  return null;
}
