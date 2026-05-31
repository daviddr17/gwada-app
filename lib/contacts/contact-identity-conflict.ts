import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { formatGwadaContactTitle } from "@/lib/contact-messages/waha-chat-label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ContactEmailInput,
  ContactPhoneInput,
} from "@/lib/supabase/contacts-db";

export type ContactIdentityConflict = {
  contactId: string;
  field: "email" | "phone";
  value: string;
  displayName: string;
};

type ContactNameRow = {
  first_name: string;
  last_name: string;
  company: string | null;
};

function displayNameFromRow(row: ContactNameRow): string {
  const person = `${row.first_name} ${row.last_name}`.trim() || "Unbenannt";
  return formatGwadaContactTitle(person, row.company);
}

function contactNameFromEmbed(
  embed: ContactNameRow | ContactNameRow[] | null | undefined,
): ContactNameRow | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

/** Keine WhatsApp-JID oder Rohnummer als E-Mail speichern. */
export function isInvalidContactEmailValue(email: string): boolean {
  const t = email.trim().toLowerCase();
  if (!t.includes("@")) return false;
  if (/@(c\.us|lid|s\.whatsapp\.net)$/i.test(t)) return true;
  if (/^\+?[\d\s().-]+@[\w.]+$/.test(t) && t.replace(/\D/g, "").length >= 10) {
    const local = t.split("@")[0] ?? "";
    if (/^\+?[\d\s().-]+$/.test(local)) return true;
  }
  return false;
}

export function formatContactIdentityConflictMessage(
  conflict: ContactIdentityConflict,
): string {
  const label = conflict.field === "email" ? "E-Mail" : "Telefonnummer";
  return `Diese ${label} (${conflict.value}) ist bereits beim Kontakt „${conflict.displayName}“ hinterlegt. Bitte diesen Kontakt öffnen oder eine andere ${label} verwenden.`;
}

export function mapContactPersistenceError(message: string): string {
  if (message.includes("contact_emails_restaurant_normalized_idx")) {
    return "Diese E-Mail-Adresse ist bereits bei einem anderen Kontakt in diesem Restaurant hinterlegt.";
  }
  if (message.includes("contact_phones_restaurant_normalized_idx")) {
    return "Diese Telefonnummer ist bereits bei einem anderen Kontakt in diesem Restaurant hinterlegt.";
  }
  return message;
}

export async function findContactIdentityConflict(params: {
  restaurantId: string;
  emails: ContactEmailInput[];
  phones: ContactPhoneInput[];
  excludeContactId?: string;
}): Promise<ContactIdentityConflict | null> {
  const sb = createSupabaseBrowserClient();

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
        contacts: ContactNameRow | ContactNameRow[];
      };
      const contactRow = contactNameFromEmbed(r.contacts);
      if (!contactRow) continue;
      if (
        params.excludeContactId &&
        r.contact_id === params.excludeContactId
      ) {
        continue;
      }
      return {
        contactId: r.contact_id,
        field: "email",
        value: r.email,
        displayName: displayNameFromRow(contactRow),
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
        contacts: ContactNameRow | ContactNameRow[];
      };
      const contactRow = contactNameFromEmbed(r.contacts);
      if (!contactRow) continue;
      if (
        params.excludeContactId &&
        r.contact_id === params.excludeContactId
      ) {
        continue;
      }
      return {
        contactId: r.contact_id,
        field: "phone",
        value: r.phone_display,
        displayName: displayNameFromRow(contactRow),
      };
    }
  }

  return null;
}

export async function findContactByEmailNormalized(params: {
  restaurantId: string;
  emailNormalized: string;
}): Promise<{ contactId: string; displayName: string } | null> {
  const norm = params.emailNormalized.trim().toLowerCase();
  if (!norm) return null;

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_emails")
    .select(
      "contact_id, contacts!inner(first_name, last_name, company)",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("email_normalized", norm)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as {
    contact_id: string;
    contacts: ContactNameRow | ContactNameRow[];
  };
  const contactRow = contactNameFromEmbed(row.contacts);
  if (!contactRow) return null;
  return {
    contactId: row.contact_id,
    displayName: displayNameFromRow(contactRow),
  };
}

export async function findContactByPhoneNormalized(params: {
  restaurantId: string;
  phoneNormalized: string;
}): Promise<{ contactId: string; displayName: string } | null> {
  const norm = params.phoneNormalized.replace(/\D/g, "");
  if (!norm) return null;

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_phones")
    .select(
      "contact_id, contacts!inner(first_name, last_name, company)",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("phone_normalized", norm)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as {
    contact_id: string;
    contacts: ContactNameRow | ContactNameRow[];
  };
  const contactRow = contactNameFromEmbed(row.contacts);
  if (!contactRow) return null;
  return {
    contactId: row.contact_id,
    displayName: displayNameFromRow(contactRow),
  };
}
