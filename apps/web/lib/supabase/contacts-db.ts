import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  findContactIdentityConflict,
  formatContactIdentityConflictMessage,
  mapContactPersistenceError,
} from "@/lib/contacts/contact-identity-conflict";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { formatGwadaContactTitle } from "@/lib/contact-messages/waha-chat-label";
import {
  fetchContactTagsByContactIds,
  type ContactTagRow,
} from "@/lib/supabase/contact-tags-db";

export {
  findContactByEmailNormalized,
  findContactByPhoneNormalized,
} from "@/lib/contacts/contact-identity-conflict";

export type ContactEmailRow = {
  id: string;
  contact_id: string;
  email: string;
  label: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ContactPhoneRow = {
  id: string;
  contact_id: string;
  phone_display: string;
  country_iso2: string | null;
  label: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ContactMessagingIdRow = {
  id: string;
  contact_id: string;
  platform: "facebook" | "instagram";
  external_sender_id: string;
  label: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type ContactListRow = {
  id: string;
  restaurant_id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_interaction_at: string | null;
  contact_emails: ContactEmailRow[];
  contact_phones: ContactPhoneRow[];
  contact_messaging_ids: ContactMessagingIdRow[];
  reservation_count: number;
  message_count: number;
  tags: ContactTagRow[];
};

export type ContactReservationLink = {
  id: string;
  reservation_number: number;
  guest_first_name: string;
  guest_last_name: string;
  starts_at: string;
  party_size: number;
  reservation_statuses: { code: string; name: string; color_hex: string } | null;
};

export type ContactDetail = ContactListRow & {
  reservations: ContactReservationLink[];
};

const CONTACT_LIST_SELECT = `
  id,
  restaurant_id,
  first_name,
  last_name,
  company,
  address_street,
  address_postal_code,
  address_city,
  address_country,
  notes,
  created_at,
  updated_at,
  last_interaction_at,
  contact_emails ( id, contact_id, email, label, is_primary, sort_order ),
  contact_phones ( id, contact_id, phone_display, country_iso2, label, is_primary, sort_order ),
  contact_messaging_ids ( id, contact_id, platform, external_sender_id, label, is_primary, sort_order )
`;

function mapContactListRow(
  row: Record<string, unknown>,
  reservationCount: number,
  messageCount: number,
  tags: ContactTagRow[] = [],
): ContactListRow {
  const emails = row.contact_emails;
  const phones = row.contact_phones;
  const messagingIds = row.contact_messaging_ids;
  return {
    ...(row as Omit<
      ContactListRow,
      | "contact_emails"
      | "contact_phones"
      | "contact_messaging_ids"
      | "reservation_count"
      | "message_count"
      | "tags"
    >),
    contact_emails: (Array.isArray(emails) ? emails : []) as ContactEmailRow[],
    contact_phones: (Array.isArray(phones) ? phones : []) as ContactPhoneRow[],
    contact_messaging_ids: (Array.isArray(messagingIds)
      ? messagingIds
      : []) as ContactMessagingIdRow[],
    reservation_count: reservationCount,
    message_count: messageCount,
    tags,
  };
}

export async function fetchContactsForRestaurant(
  restaurantId: string,
): Promise<{ data: ContactListRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contacts")
    .select(CONTACT_LIST_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  const ids = rows.map((r) => r.id as string);
  const { data: counts, error: countErr } = await sb
    .from("reservations")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .in("contact_id", ids);

  if (countErr) {
    return { data: [], error: new Error(countErr.message) };
  }

  const countByContact = new Map<string, number>();
  for (const c of counts ?? []) {
    const cid = (c as { contact_id: string | null }).contact_id;
    if (!cid) continue;
    countByContact.set(cid, (countByContact.get(cid) ?? 0) + 1);
  }

  const { data: msgCounts, error: msgErr } = await sb
    .from("contact_messages")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .in("contact_id", ids);

  if (msgErr) {
    return { data: [], error: new Error(msgErr.message) };
  }

  const messageCountByContact = new Map<string, number>();
  for (const m of msgCounts ?? []) {
    const cid = (m as { contact_id: string }).contact_id;
    messageCountByContact.set(cid, (messageCountByContact.get(cid) ?? 0) + 1);
  }

  const { data: tagsByContact, error: tagsErr } =
    await fetchContactTagsByContactIds(restaurantId, ids);
  if (tagsErr) {
    return { data: [], error: tagsErr };
  }

  return {
    data: rows.map((r) =>
      mapContactListRow(
        r,
        countByContact.get(r.id as string) ?? 0,
        messageCountByContact.get(r.id as string) ?? 0,
        tagsByContact.get(r.id as string) ?? [],
      ),
    ),
    error: null,
  };
}

export async function fetchContactById(params: {
  restaurantId: string;
  contactId: string;
}): Promise<{ data: ContactDetail | null; error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId)
  ) {
    return { data: null, error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contacts")
    .select(CONTACT_LIST_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.contactId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: null };
  }

  const { data: reservations, error: resErr } = await sb
    .from("reservations")
    .select(
      `
      id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      starts_at,
      party_size,
      ${RESERVATION_STATUS_EMBED} ( code, name, color_hex )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .order("starts_at", { ascending: false });

  if (resErr) {
    return { data: null, error: new Error(resErr.message) };
  }

  const { count: messageCount, error: msgCountErr } = await sb
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId);

  if (msgCountErr) {
    return { data: null, error: new Error(msgCountErr.message) };
  }

  const { data: tagsByContact, error: tagsErr } =
    await fetchContactTagsByContactIds(params.restaurantId, [params.contactId]);
  if (tagsErr) {
    return { data: null, error: tagsErr };
  }

  const mapped = mapContactListRow(
    data as Record<string, unknown>,
    (reservations ?? []).length,
    messageCount ?? 0,
    tagsByContact.get(params.contactId) ?? [],
  );

  const resRows = (reservations ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const st = row.reservation_statuses;
    const status = Array.isArray(st) ? (st[0] ?? null) : st;
    return {
      id: row.id as string,
      reservation_number: row.reservation_number as number,
      guest_first_name: row.guest_first_name as string,
      guest_last_name: row.guest_last_name as string,
      starts_at: row.starts_at as string,
      party_size: row.party_size as number,
      reservation_statuses: status as ContactReservationLink["reservation_statuses"],
    };
  });

  return {
    data: { ...mapped, reservations: resRows },
    error: null,
  };
}

export type ContactEmailInput = {
  id?: string;
  email: string;
  label?: string | null;
  isPrimary?: boolean;
};

export type ContactPhoneInput = {
  id?: string;
  phoneDisplay: string;
  countryIso2?: string | null;
  label?: string | null;
  isPrimary?: boolean;
};

export type ContactUpsertPayload = {
  restaurantId: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  addressStreet?: string | null;
  addressPostalCode?: string | null;
  addressCity?: string | null;
  addressCountry?: string | null;
  notes?: string | null;
  emails: ContactEmailInput[];
  phones: ContactPhoneInput[];
};

async function replaceContactEmails(
  contactId: string,
  restaurantId: string,
  emails: ContactEmailInput[],
): Promise<Error | null> {
  const sb = createSupabaseBrowserClient();
  const { error: delErr } = await sb
    .from("contact_emails")
    .delete()
    .eq("contact_id", contactId);
  if (delErr) return new Error(delErr.message);

  const seenNorms = new Set<string>();
  const rows = emails.flatMap((e, i) => {
    const norm = normalizeContactEmail(e.email);
    if (!norm || seenNorms.has(norm)) return [];
    seenNorms.add(norm);
    return [
      {
        contact_id: contactId,
        restaurant_id: restaurantId,
        email: e.email.trim(),
        email_normalized: norm,
        label: e.label?.trim() || null,
        is_primary: e.isPrimary ?? i === 0,
        sort_order: i,
      },
    ];
  });

  if (rows.length === 0) return null;

  const { error } = await sb.from("contact_emails").insert(rows);
  if (error) return new Error(mapContactPersistenceError(error.message));
  return null;
}

async function replaceContactPhones(
  contactId: string,
  restaurantId: string,
  phones: ContactPhoneInput[],
): Promise<Error | null> {
  const sb = createSupabaseBrowserClient();
  const { error: delErr } = await sb
    .from("contact_phones")
    .delete()
    .eq("contact_id", contactId);
  if (delErr) return new Error(delErr.message);

  const seenPhoneNorms = new Set<string>();
  const rows = phones.flatMap((p, i) => {
    const norm = normalizeContactPhone(p.phoneDisplay);
    if (!norm || seenPhoneNorms.has(norm)) return [];
    seenPhoneNorms.add(norm);
    return [
      {
        contact_id: contactId,
        restaurant_id: restaurantId,
        phone_display: p.phoneDisplay.trim(),
        phone_normalized: norm,
        country_iso2: p.countryIso2?.trim() || null,
        label: p.label?.trim() || null,
        is_primary: p.isPrimary ?? i === 0,
        sort_order: i,
      },
    ];
  });

  if (rows.length === 0) return null;

  const { error } = await sb.from("contact_phones").insert(rows);
  if (error) return new Error(mapContactPersistenceError(error.message));
  return null;
}

async function deleteContactOrphan(
  contactId: string,
  restaurantId: string,
): Promise<void> {
  const sb = createSupabaseBrowserClient();
  await sb
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("restaurant_id", restaurantId);
}

export async function insertContact(
  payload: ContactUpsertPayload,
): Promise<{ data: { id: string } | null; error: Error | null }> {
  if (!isUuidRestaurantId(payload.restaurantId)) {
    return { data: null, error: new Error("Ungültige Restaurant-ID.") };
  }

  try {
    const conflict = await findContactIdentityConflict({
      restaurantId: payload.restaurantId,
      emails: payload.emails,
      phones: payload.phones,
    });
    if (conflict) {
      return {
        data: null,
        error: new Error(formatContactIdentityConflictMessage(conflict)),
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kontakt konnte nicht geprüft werden.";
    return { data: null, error: new Error(msg) };
  }

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contacts")
    .insert({
      restaurant_id: payload.restaurantId,
      first_name: payload.firstName.trim() || "Gast",
      last_name: payload.lastName.trim(),
      company: payload.company?.trim() || null,
      address_street: payload.addressStreet?.trim() || null,
      address_postal_code: payload.addressPostalCode?.trim() || null,
      address_city: payload.addressCity?.trim() || null,
      address_country: payload.addressCountry?.trim() || null,
      notes: payload.notes?.trim() || null,
      last_interaction_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  const id = (data as { id: string }).id;

  const emailErr = await replaceContactEmails(
    id,
    payload.restaurantId,
    payload.emails,
  );
  if (emailErr) {
    await deleteContactOrphan(id, payload.restaurantId);
    return { data: null, error: emailErr };
  }

  const phoneErr = await replaceContactPhones(
    id,
    payload.restaurantId,
    payload.phones,
  );
  if (phoneErr) {
    await deleteContactOrphan(id, payload.restaurantId);
    return { data: null, error: phoneErr };
  }

  return { data: { id }, error: null };
}

export async function updateContact(
  contactId: string,
  payload: ContactUpsertPayload,
): Promise<{ error: Error | null }> {
  if (
    !isUuidRestaurantId(payload.restaurantId) ||
    !isUuidRestaurantId(contactId)
  ) {
    return { error: new Error("Ungültige ID.") };
  }

  try {
    const conflict = await findContactIdentityConflict({
      restaurantId: payload.restaurantId,
      emails: payload.emails,
      phones: payload.phones,
      excludeContactId: contactId,
    });
    if (conflict) {
      return {
        error: new Error(formatContactIdentityConflictMessage(conflict)),
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kontakt konnte nicht geprüft werden.";
    return { error: new Error(msg) };
  }

  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("contacts")
    .update({
      first_name: payload.firstName.trim() || "Gast",
      last_name: payload.lastName.trim(),
      company: payload.company?.trim() || null,
      address_street: payload.addressStreet?.trim() || null,
      address_postal_code: payload.addressPostalCode?.trim() || null,
      address_city: payload.addressCity?.trim() || null,
      address_country: payload.addressCountry?.trim() || null,
      notes: payload.notes?.trim() || null,
    })
    .eq("id", contactId)
    .eq("restaurant_id", payload.restaurantId);

  if (error) {
    return { error: new Error(error.message) };
  }

  const emailErr = await replaceContactEmails(
    contactId,
    payload.restaurantId,
    payload.emails,
  );
  if (emailErr) return { error: emailErr };

  const phoneErr = await replaceContactPhones(
    contactId,
    payload.restaurantId,
    payload.phones,
  );
  if (phoneErr) return { error: phoneErr };

  return { error: null };
}

export async function deleteContact(params: {
  restaurantId: string;
  contactId: string;
}): Promise<{ error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId)
  ) {
    return { error: new Error("Ungültige ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("contacts")
    .delete()
    .eq("id", params.contactId)
    .eq("restaurant_id", params.restaurantId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

const DEFAULT_CONTACT_FIRST_NAME = "Gast";

/** Persönlicher Name ohne DB-Platzhalter „Gast“ (nur Vorname, kein Nachname). */
export function contactPersonalName(row: {
  first_name: string;
  last_name: string;
}): string {
  const first = row.first_name.trim();
  const last = row.last_name.trim();
  const effectiveFirst =
    first === DEFAULT_CONTACT_FIRST_NAME && !last ? "" : first;
  return `${effectiveFirst} ${last}`.trim();
}

export function contactDisplayName(row: {
  first_name: string;
  last_name: string;
  company?: string | null;
}): string {
  const personal = contactPersonalName(row);
  if (personal) return personal;
  const company = row.company?.trim();
  if (company) return company;
  return "Unbenannt";
}

/** Tabellen-Spalten Vorname/Nachname — „—“ wenn kein persönlicher Name. */
export function contactOverviewFirstName(row: {
  first_name: string;
  last_name: string;
}): string {
  if (!contactPersonalName(row)) return "—";
  return row.first_name.trim() || "—";
}

export function contactOverviewLastName(row: {
  first_name: string;
  last_name: string;
}): string {
  if (!contactPersonalName(row)) return "—";
  return row.last_name.trim() || "—";
}

/** Chat-/Thread-Überschrift inkl. Firma, wenn hinterlegt. */
export function contactThreadDisplayName(row: {
  first_name: string;
  last_name: string;
  company?: string | null;
}): string {
  return formatGwadaContactTitle(contactPersonalName(row), row.company);
}

export {
  hasMessagingPlatform,
  primaryMessagingId,
} from "@/lib/supabase/contact-messaging-ids-db";

export function primaryEmail(row: ContactListRow): string | null {
  const sorted = [...row.contact_emails].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return sorted[0]?.email ?? null;
}

export function primaryPhone(row: ContactListRow): string | null {
  const sorted = [...row.contact_phones].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return sorted[0]?.phone_display ?? null;
}

export function allEmailsLabel(row: ContactListRow): string {
  if (row.contact_emails.length === 0) return "—";
  return row.contact_emails
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    )
    .map((e) => e.email)
    .join(", ");
}

export function contactAddressLabel(row: {
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
}): string {
  const line2 = [row.address_postal_code, row.address_city]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  const parts = [
    row.address_street?.trim(),
    line2 || null,
    row.address_country?.trim(),
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Primär + „+N“ wenn weitere Einträge. */
export function channelCellLabel(
  values: string[],
): { primary: string; extra: number } {
  const list = values.map((v) => v.trim()).filter(Boolean);
  if (list.length === 0) return { primary: "—", extra: 0 };
  return { primary: list[0]!, extra: Math.max(0, list.length - 1) };
}

export function emailsForCell(row: ContactListRow): string[] {
  return [...row.contact_emails]
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    )
    .map((e) => e.email);
}

export function phonesForCell(row: ContactListRow): string[] {
  return [...row.contact_phones]
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    )
    .map((p) => p.phone_display);
}

export async function fetchContactReservationsQuick(
  restaurantId: string,
  contactId: string,
): Promise<{ data: ContactReservationLink[]; error: Error | null }> {
  const { data, error } = await fetchContactById({ restaurantId, contactId });
  if (error) return { data: [], error };
  return { data: data?.reservations ?? [], error: null };
}

export function allPhonesLabel(row: ContactListRow): string {
  if (row.contact_phones.length === 0) return "—";
  return row.contact_phones
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order,
    )
    .map((p) => p.phone_display)
    .join(", ");
}
