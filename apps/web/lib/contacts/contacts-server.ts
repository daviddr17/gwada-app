import "server-only";

import { mapContactPersistenceError } from "@/lib/contacts/contact-identity-conflict";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { findLexofficeContactByIdentity } from "@/lib/contacts/build-unified-contacts-server";
import {
  createLexofficeContact,
  gwadaPayloadToLexofficeCreateBody,
  type LexofficeContact,
} from "@/lib/integrations/lexoffice-contacts";
import { readLexofficeContactsCache } from "@/lib/contacts/lexoffice-contacts-cache-db";
import {
  syncLexofficeContactsCache,
  triggerLexofficeContactsSyncIfStale,
} from "@/lib/contacts/lexoffice-contacts-sync-server";
import { fetchLexofficeProfile } from "@/lib/integrations/lexoffice-api";
import { lexofficeConfigFromJson } from "@/lib/integrations/lexoffice-integration-config";
import { assertPlatformLexofficeEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  fetchContactLexofficeLinkForContact,
  upsertContactLexofficeLink,
} from "@/lib/supabase/contact-lexoffice-links-db";
import {
  fetchRestaurantLexofficeConfig,
  fetchRestaurantLexofficeConfigAdmin,
} from "@/lib/supabase/restaurant-lexoffice-integration-db";
import type {
  ContactEmailInput,
  ContactListRow,
  ContactPhoneInput,
  ContactUpsertPayload,
} from "@/lib/supabase/contacts-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LexofficeContactsIntegrationStatus = {
  platformEnabled: boolean;
  connected: boolean;
};

export async function resolveLexofficeContactsIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  options?: { verifyProfile?: boolean },
): Promise<
  | { ok: true; apiKey: string }
  | { ok: false; status: LexofficeContactsIntegrationStatus; error?: string }
> {
  const platform = await assertPlatformLexofficeEnabled(sb);
  if (!platform.ok) {
    return {
      ok: false,
      status: { platformEnabled: false, connected: false },
      error: "Lexware ist auf Plattform-Ebene deaktiviert.",
    };
  }

  const row =
    (await fetchRestaurantLexofficeConfigAdmin(restaurantId)) ??
    (await fetchRestaurantLexofficeConfig(sb, restaurantId));
  if (!row || row.status !== "working") {
    return {
      ok: false,
      status: { platformEnabled: true, connected: false },
      error: "Lexware Office ist für dieses Restaurant nicht verbunden.",
    };
  }

  const apiKey = lexofficeConfigFromJson(row.config).api_key?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: { platformEnabled: true, connected: false },
      error: "Lexware API-Key fehlt in den Einstellungen.",
    };
  }

  if (options?.verifyProfile) {
    const profile = await fetchLexofficeProfile(apiKey);
    if (!profile.ok) {
      return {
        ok: false,
        status: { platformEnabled: true, connected: false },
        error: profile.error,
      };
    }
  }

  return { ok: true, apiKey };
}

export async function getLexofficeContactsIntegrationStatus(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<LexofficeContactsIntegrationStatus> {
  const resolved = await resolveLexofficeContactsIntegration(sb, restaurantId);
  if (resolved.ok) {
    return { platformEnabled: true, connected: true };
  }
  return resolved.status;
}

async function replaceContactEmailsServer(
  sb: SupabaseClient,
  contactId: string,
  restaurantId: string,
  emails: ContactEmailInput[],
): Promise<Error | null> {
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

async function replaceContactPhonesServer(
  sb: SupabaseClient,
  contactId: string,
  restaurantId: string,
  phones: ContactPhoneInput[],
): Promise<Error | null> {
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

async function deleteContactOrphanServer(
  sb: SupabaseClient,
  contactId: string,
  restaurantId: string,
): Promise<void> {
  await sb
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .eq("restaurant_id", restaurantId);
}

export async function findContactIdentityConflictServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    emails: ContactEmailInput[];
    phones: ContactPhoneInput[];
    excludeContactId?: string;
    lexofficeContacts?: LexofficeContact[];
    allowLexofficeMatch?: boolean;
  },
): Promise<{ kind: "gwada" | "lexoffice"; message: string } | null> {
  const emailNorms = [
    ...new Set(
      params.emails
        .map((e) => normalizeContactEmail(e.email))
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  if (emailNorms.length > 0) {
    const { data, error } = await sb
      .from("contact_emails")
      .select(
        "contact_id, email, contacts!inner(first_name, last_name, company)",
      )
      .eq("restaurant_id", params.restaurantId)
      .in("email_normalized", emailNorms);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as {
        contact_id: string;
        email: string;
        contacts:
          | { first_name: string; last_name: string; company: string | null }
          | { first_name: string; last_name: string; company: string | null }[];
      };
      if (params.excludeContactId && r.contact_id === params.excludeContactId) {
        continue;
      }
      const contactRow = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      if (!contactRow) continue;
      const displayName =
        `${contactRow.first_name} ${contactRow.last_name}`.trim() || "Unbenannt";
      return {
        kind: "gwada",
        message: `Diese E-Mail (${r.email}) ist bereits beim Kontakt „${displayName}“ hinterlegt.`,
      };
    }
  }

  const phoneNorms = [
    ...new Set(
      params.phones
        .map((p) => normalizeContactPhone(p.phoneDisplay))
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  if (phoneNorms.length > 0) {
    const { data, error } = await sb
      .from("contact_phones")
      .select(
        "contact_id, phone_display, contacts!inner(first_name, last_name, company)",
      )
      .eq("restaurant_id", params.restaurantId)
      .in("phone_normalized", phoneNorms);

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const r = row as {
        contact_id: string;
        phone_display: string;
        contacts:
          | { first_name: string; last_name: string; company: string | null }
          | { first_name: string; last_name: string; company: string | null }[];
      };
      if (params.excludeContactId && r.contact_id === params.excludeContactId) {
        continue;
      }
      const contactRow = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      if (!contactRow) continue;
      const displayName =
        `${contactRow.first_name} ${contactRow.last_name}`.trim() || "Unbenannt";
      return {
        kind: "gwada",
        message: `Diese Telefonnummer (${r.phone_display}) ist bereits beim Kontakt „${displayName}“ hinterlegt.`,
      };
    }
  }

  if (params.allowLexofficeMatch && params.lexofficeContacts?.length) {
    const lexMatch = findLexofficeContactByIdentity(
      params.lexofficeContacts,
      params.emails.map((e) => e.email),
      params.phones.map((p) => p.phoneDisplay),
    );
    if (lexMatch) {
      return {
        kind: "lexoffice",
        message:
          "Diese E-Mail oder Telefonnummer ist bereits in Lexware Office hinterlegt. Lege den Kontakt in Gwada an — er wird automatisch zusammengeführt.",
      };
    }
  }

  return null;
}

export async function insertContactServer(
  sb: SupabaseClient,
  payload: ContactUpsertPayload,
  options?: {
    syncToLexoffice?: boolean;
    lexofficeApiKey?: string;
    lexofficeContactsCache?: LexofficeContact[];
    linkExistingLexofficeId?: string | null;
  },
): Promise<{
  data: { id: string; lexofficeContactId?: string | null } | null;
  error: Error | null;
}> {
  if (!isUuidRestaurantId(payload.restaurantId)) {
    return { data: null, error: new Error("Ungültige Restaurant-ID.") };
  }

  try {
    const lexMatch =
      options?.lexofficeContactsCache?.length &&
      findLexofficeContactByIdentity(
        options.lexofficeContactsCache,
        payload.emails.map((e) => e.email),
        payload.phones.map((p) => p.phoneDisplay),
      );

    const conflict = await findContactIdentityConflictServer(sb, {
      restaurantId: payload.restaurantId,
      emails: payload.emails,
      phones: payload.phones,
      lexofficeContacts: options?.lexofficeContactsCache,
      allowLexofficeMatch: !options?.syncToLexoffice && !lexMatch,
    });
    if (conflict) {
      return { data: null, error: new Error(conflict.message) };
    }
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Kontakt konnte nicht geprüft werden.";
    return { data: null, error: new Error(msg) };
  }

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

  const emailErr = await replaceContactEmailsServer(
    sb,
    id,
    payload.restaurantId,
    payload.emails,
  );
  if (emailErr) {
    await deleteContactOrphanServer(sb, id, payload.restaurantId);
    return { data: null, error: emailErr };
  }

  const phoneErr = await replaceContactPhonesServer(
    sb,
    id,
    payload.restaurantId,
    payload.phones,
  );
  if (phoneErr) {
    await deleteContactOrphanServer(sb, id, payload.restaurantId);
    return { data: null, error: phoneErr };
  }

  const existingLexMatch =
    options?.linkExistingLexofficeId ??
    (options?.lexofficeContactsCache?.length
      ? findLexofficeContactByIdentity(
          options.lexofficeContactsCache,
          payload.emails.map((e) => e.email),
          payload.phones.map((p) => p.phoneDisplay),
        )?.id ?? null
      : null);

  let lexofficeContactId: string | null = existingLexMatch;

  if (
    options?.syncToLexoffice &&
    options.lexofficeApiKey &&
    !lexofficeContactId
  ) {
    const createBody = gwadaPayloadToLexofficeCreateBody(payload);
    const created = await createLexofficeContact(
      options.lexofficeApiKey,
      createBody,
    );
    if (!created.ok) {
      await deleteContactOrphanServer(sb, id, payload.restaurantId);
      return {
        data: null,
        error: new Error(
          created.error ?? "Lexware-Kontakt konnte nicht angelegt werden.",
        ),
      };
    }
    lexofficeContactId = created.id;
  }

  if (lexofficeContactId) {
    const { error: linkErr } = await upsertContactLexofficeLink(sb, {
      restaurantId: payload.restaurantId,
      contactId: id,
      lexofficeContactId,
    });
    if (linkErr) {
      console.warn("upsertContactLexofficeLink", linkErr);
    }
  }

  return {
    data: { id, lexofficeContactId },
    error: null,
  };
}

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
  contact_phones ( id, contact_id, phone_display, country_iso2, label, is_primary, sort_order )
`;

export async function fetchContactsForRestaurantServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ data: ContactListRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: null };
  }

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
  const [{ data: counts }, { data: msgCounts }] = await Promise.all([
    sb
      .from("reservations")
      .select("contact_id")
      .eq("restaurant_id", restaurantId)
      .in("contact_id", ids),
    sb
      .from("contact_messages")
      .select("contact_id")
      .eq("restaurant_id", restaurantId)
      .in("contact_id", ids),
  ]);

  const countByContact = new Map<string, number>();
  for (const c of counts ?? []) {
    const cid = (c as { contact_id: string | null }).contact_id;
    if (!cid) continue;
    countByContact.set(cid, (countByContact.get(cid) ?? 0) + 1);
  }

  const messageCountByContact = new Map<string, number>();
  for (const m of msgCounts ?? []) {
    const cid = (m as { contact_id: string }).contact_id;
    messageCountByContact.set(cid, (messageCountByContact.get(cid) ?? 0) + 1);
  }

  return {
    data: rows.map((r) => ({
      ...(r as Omit<
        ContactListRow,
        "contact_emails" | "contact_phones" | "reservation_count" | "message_count"
      >),
      contact_emails: (Array.isArray(r.contact_emails)
        ? r.contact_emails
        : []) as ContactListRow["contact_emails"],
      contact_phones: (Array.isArray(r.contact_phones)
        ? r.contact_phones
        : []) as ContactListRow["contact_phones"],
      reservation_count: countByContact.get(r.id as string) ?? 0,
      message_count: messageCountByContact.get(r.id as string) ?? 0,
    })),
    error: null,
  };
}

export async function loadLexofficeContactsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  options?: {
    apiKey?: string;
    /** Live-Abruf von Lexoffice (Integrations-Refresh). */
    forceRefresh?: boolean;
  },
): Promise<
  | { ok: true; contacts: LexofficeContact[] }
  | { ok: false; contacts: LexofficeContact[]; error: string }
> {
  const resolved = options?.apiKey
    ? ({ ok: true as const, apiKey: options.apiKey })
    : await resolveLexofficeContactsIntegration(sb, restaurantId);
  if (!resolved.ok) {
    return {
      ok: false,
      contacts: [],
      error: resolved.error ?? "Lexware-Verbindung nicht verfügbar.",
    };
  }

  if (options?.forceRefresh) {
    const sync = await syncLexofficeContactsCache(
      restaurantId,
      resolved.apiKey,
    );
    if (!sync.ok) {
      return { ok: false, contacts: sync.contacts, error: sync.error };
    }
    return { ok: true, contacts: sync.contacts };
  }

  const cached = await readLexofficeContactsCache(sb, restaurantId);
  if (cached && !cached.stale) {
    return { ok: true, contacts: cached.contacts };
  }

  if (cached && cached.stale) {
    triggerLexofficeContactsSyncIfStale(restaurantId);
    return { ok: true, contacts: cached.contacts };
  }

  const sync = await syncLexofficeContactsCache(restaurantId, resolved.apiKey);
  if (!sync.ok) {
    return { ok: false, contacts: sync.contacts, error: sync.error };
  }
  return { ok: true, contacts: sync.contacts };
}

async function fetchContactUpsertPayloadServer(
  sb: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<{ payload: ContactUpsertPayload | null; error: Error | null }> {
  const { data, error } = await sb
    .from("contacts")
    .select(CONTACT_LIST_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("id", contactId)
    .maybeSingle();

  if (error) {
    return { payload: null, error: new Error(error.message) };
  }
  if (!data) {
    return { payload: null, error: new Error("Kontakt nicht gefunden.") };
  }

  const row = data as Record<string, unknown>;
  const emails = (
    Array.isArray(row.contact_emails) ? row.contact_emails : []
  ) as ContactListRow["contact_emails"];
  const phones = (
    Array.isArray(row.contact_phones) ? row.contact_phones : []
  ) as ContactListRow["contact_phones"];

  return {
    payload: {
      restaurantId,
      firstName: (row.first_name as string) ?? "Gast",
      lastName: (row.last_name as string) ?? "",
      company: (row.company as string | null) ?? null,
      addressStreet: (row.address_street as string | null) ?? null,
      addressPostalCode: (row.address_postal_code as string | null) ?? null,
      addressCity: (row.address_city as string | null) ?? null,
      addressCountry: (row.address_country as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      emails: emails
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((e) => ({
          email: e.email,
          label: e.label,
          isPrimary: e.is_primary,
        })),
      phones: phones
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          phoneDisplay: p.phone_display,
          countryIso2: p.country_iso2,
          label: p.label,
          isPrimary: p.is_primary,
        })),
    },
    error: null,
  };
}

export type ContactLexofficeLinkStatus = {
  linked: boolean;
  inLexoffice: boolean;
  canAddToLexoffice: boolean;
  canLinkToLexoffice: boolean;
  lexofficeContactId: string | null;
};

export async function getContactLexofficeLinkStatusServer(
  sb: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<
  | { ok: true; status: ContactLexofficeLinkStatus }
  | { ok: false; error: string }
> {
  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(contactId)) {
    return { ok: false, error: "Ungültige ID." };
  }

  const existingLink = await fetchContactLexofficeLinkForContact(
    sb,
    restaurantId,
    contactId,
  );
  if (existingLink) {
    return {
      ok: true,
      status: {
        linked: true,
        inLexoffice: true,
        canAddToLexoffice: false,
        canLinkToLexoffice: false,
        lexofficeContactId: existingLink.lexoffice_contact_id,
      },
    };
  }

  const resolved = await resolveLexofficeContactsIntegration(sb, restaurantId);
  if (!resolved.ok) {
    return {
      ok: true,
      status: {
        linked: false,
        inLexoffice: false,
        canAddToLexoffice: false,
        canLinkToLexoffice: false,
        lexofficeContactId: null,
      },
    };
  }

  const { payload, error } = await fetchContactUpsertPayloadServer(
    sb,
    restaurantId,
    contactId,
  );
  if (error || !payload) {
    return { ok: false, error: error?.message ?? "Kontakt nicht gefunden." };
  }

  const loaded = await loadLexofficeContactsForRestaurant(sb, restaurantId);
  const lexMatch = loaded.contacts.length
    ? findLexofficeContactByIdentity(
        loaded.contacts,
        payload.emails.map((e) => e.email),
        payload.phones.map((p) => p.phoneDisplay),
      )
    : null;

  if (lexMatch) {
    return {
      ok: true,
      status: {
        linked: false,
        inLexoffice: true,
        canAddToLexoffice: false,
        canLinkToLexoffice: true,
        lexofficeContactId: lexMatch.id,
      },
    };
  }

  return {
    ok: true,
    status: {
      linked: false,
      inLexoffice: false,
      canAddToLexoffice: true,
      canLinkToLexoffice: false,
      lexofficeContactId: null,
    },
  };
}

export async function syncExistingContactToLexofficeServer(
  sb: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<
  | {
      ok: true;
      lexofficeContactId: string;
      created: boolean;
      alreadyLinked: boolean;
    }
  | { ok: false; error: string }
> {
  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(contactId)) {
    return { ok: false, error: "Ungültige ID." };
  }

  const existingLink = await fetchContactLexofficeLinkForContact(
    sb,
    restaurantId,
    contactId,
  );
  if (existingLink) {
    return {
      ok: true,
      lexofficeContactId: existingLink.lexoffice_contact_id,
      created: false,
      alreadyLinked: true,
    };
  }

  const resolved = await resolveLexofficeContactsIntegration(sb, restaurantId);
  if (!resolved.ok) {
    return { ok: false, error: "Lexware Office ist nicht verbunden." };
  }

  const { payload, error } = await fetchContactUpsertPayloadServer(
    sb,
    restaurantId,
    contactId,
  );
  if (error || !payload) {
    return { ok: false, error: error?.message ?? "Kontakt nicht gefunden." };
  }

  if (payload.emails.length === 0 && payload.phones.length === 0) {
    return {
      ok: false,
      error: "Mindestens eine E-Mail oder Telefonnummer für Lexware nötig.",
    };
  }

  const loaded = await loadLexofficeContactsForRestaurant(sb, restaurantId);
  const lexMatch = loaded.contacts.length
    ? findLexofficeContactByIdentity(
        loaded.contacts,
        payload.emails.map((e) => e.email),
        payload.phones.map((p) => p.phoneDisplay),
      )
    : null;

  let lexofficeContactId = lexMatch?.id ?? null;
  let created = false;

  if (!lexofficeContactId) {
    const createBody = gwadaPayloadToLexofficeCreateBody(payload);
    const createdResult = await createLexofficeContact(
      resolved.apiKey,
      createBody,
    );
    if (!createdResult.ok) {
      return {
        ok: false,
        error:
          createdResult.error ?? "Lexware-Kontakt konnte nicht angelegt werden.",
      };
    }
    lexofficeContactId = createdResult.id;
    created = true;
  }

  const { error: linkErr } = await upsertContactLexofficeLink(sb, {
    restaurantId,
    contactId,
    lexofficeContactId,
  });
  if (linkErr) {
    return { ok: false, error: linkErr };
  }

  if (created) {
    void syncLexofficeContactsCache(restaurantId, resolved.apiKey);
  }

  return {
    ok: true,
    lexofficeContactId,
    created,
    alreadyLinked: false,
  };
}

export type ContactMissingFieldsPatch = {
  name?: string;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
};

export async function patchContactMissingFieldsServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    gwadaContactId: string | null;
    lexofficeContactId: string | null;
    base: {
      first_name: string;
      last_name: string;
      company: string | null;
      address_street: string | null;
      address_postal_code: string | null;
      address_city: string | null;
      address_country: string | null;
      emails: string[];
      phones: string[];
    };
    patch: ContactMissingFieldsPatch;
  },
): Promise<
  | { ok: true; contactId: string; updatedFields: string[] }
  | { ok: false; error: string }
> {
  const updatedFields: string[] = [];
  const p = params.patch;

  if (p.name?.trim()) updatedFields.push("name");
  if (p.street?.trim()) updatedFields.push("street");
  if (p.zip?.trim()) updatedFields.push("zip");
  if (p.city?.trim()) updatedFields.push("city");
  if (p.country?.trim()) updatedFields.push("country");
  if (p.email?.trim()) updatedFields.push("email");
  if (p.phone?.trim()) updatedFields.push("phone");

  if (updatedFields.length === 0) {
    return {
      ok: true,
      contactId: params.gwadaContactId ?? "",
      updatedFields: [],
    };
  }

  const parseName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return { firstName: "Gast", lastName: "" };
    const space = trimmed.indexOf(" ");
    if (space <= 0) return { firstName: trimmed, lastName: "" };
    return {
      firstName: trimmed.slice(0, space),
      lastName: trimmed.slice(space + 1).trim(),
    };
  };

  const buildPayload = (
    existing: ContactUpsertPayload | null,
  ): ContactUpsertPayload => {
    const base = params.base;
    const parsedName = p.name?.trim() ? parseName(p.name) : null;

    const emails = [...(existing?.emails ?? [])];
    if (p.email?.trim()) {
      emails.unshift({
        email: p.email.trim(),
        label: null,
        isPrimary: emails.length === 0,
      });
    } else if (emails.length === 0 && base.emails.length > 0) {
      for (const email of base.emails) {
        emails.push({ email, label: null, isPrimary: emails.length === 0 });
      }
    }

    const phones = [...(existing?.phones ?? [])];
    if (p.phone?.trim()) {
      phones.unshift({
        phoneDisplay: p.phone.trim(),
        countryIso2: null,
        label: null,
        isPrimary: phones.length === 0,
      });
    } else if (phones.length === 0 && base.phones.length > 0) {
      for (const phone of base.phones) {
        phones.push({
          phoneDisplay: phone,
          countryIso2: null,
          label: null,
          isPrimary: phones.length === 0,
        });
      }
    }

    return {
      restaurantId: params.restaurantId,
      firstName:
        (parsedName?.firstName ??
          existing?.firstName ??
          base.first_name?.trim()) ||
        "Gast",
      lastName:
        parsedName?.lastName ?? existing?.lastName ?? base.last_name ?? "",
      company: existing?.company ?? base.company,
      addressStreet:
        p.street?.trim() ??
        existing?.addressStreet ??
        base.address_street,
      addressPostalCode:
        p.zip?.trim() ??
        existing?.addressPostalCode ??
        base.address_postal_code,
      addressCity:
        p.city?.trim() ?? existing?.addressCity ?? base.address_city,
      addressCountry:
        p.country?.trim() ??
        existing?.addressCountry ??
        base.address_country,
      notes: existing?.notes ?? null,
      emails,
      phones,
    };
  };

  if (params.gwadaContactId) {
    const loaded = await fetchContactUpsertPayloadServer(
      sb,
      params.restaurantId,
      params.gwadaContactId,
    );
    if (loaded.error || !loaded.payload) {
      return { ok: false, error: loaded.error?.message ?? "Kontakt nicht gefunden." };
    }

    const payload = buildPayload(loaded.payload);

    try {
      const conflict = await findContactIdentityConflictServer(sb, {
        restaurantId: params.restaurantId,
        emails: payload.emails,
        phones: payload.phones,
        excludeContactId: params.gwadaContactId,
      });
      if (conflict) {
        return { ok: false, error: conflict.message };
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Kontakt konnte nicht geprüft werden.";
      return { ok: false, error: msg };
    }

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
      })
      .eq("id", params.gwadaContactId)
      .eq("restaurant_id", params.restaurantId);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (p.email?.trim()) {
      const emailErr = await replaceContactEmailsServer(
        sb,
        params.gwadaContactId,
        params.restaurantId,
        payload.emails,
      );
      if (emailErr) return { ok: false, error: emailErr.message };
    }

    if (p.phone?.trim()) {
      const phoneErr = await replaceContactPhonesServer(
        sb,
        params.gwadaContactId,
        params.restaurantId,
        payload.phones,
      );
      if (phoneErr) return { ok: false, error: phoneErr.message };
    }

    return {
      ok: true,
      contactId: params.gwadaContactId,
      updatedFields,
    };
  }

  if (!params.lexofficeContactId) {
    return { ok: false, error: "Kein Gwada-Kontakt zum Aktualisieren." };
  }

  const payload = buildPayload(null);
  const loadedLex = await loadLexofficeContactsForRestaurant(
    sb,
    params.restaurantId,
  );
  const resolved = await resolveLexofficeContactsIntegration(
    sb,
    params.restaurantId,
  );

  const { data, error } = await insertContactServer(sb, payload, {
    linkExistingLexofficeId: params.lexofficeContactId,
    lexofficeContactsCache: loadedLex.contacts,
    lexofficeApiKey: resolved.ok ? resolved.apiKey : undefined,
  });

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "Kontakt konnte nicht angelegt werden.",
    };
  }

  return {
    ok: true,
    contactId: data.id,
    updatedFields,
  };
}
