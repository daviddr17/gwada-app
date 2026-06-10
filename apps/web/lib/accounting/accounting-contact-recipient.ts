import {
  unifiedContactDisplayName,
  type UnifiedContactListRow,
} from "@/lib/contacts/unified-contact-row";
import type { AccountingRecipientSnapshot } from "@/lib/types/accounting";

export type ContactRecipientFieldKey =
  | "name"
  | "street"
  | "zip"
  | "city"
  | "country"
  | "email"
  | "phone";

export const CONTACT_RECIPIENT_FIELD_LABELS: Record<
  ContactRecipientFieldKey,
  string
> = {
  name: "Name",
  street: "Straße",
  zip: "PLZ",
  city: "Ort",
  country: "Land",
  email: "E-Mail",
  phone: "Telefon",
};

export type ContactOriginallyEmptyFields = Record<
  ContactRecipientFieldKey,
  boolean
>;

export function contactRecipientDisplayName(
  row: UnifiedContactListRow,
): string {
  if (row.company?.trim()) return row.company.trim();
  const person = unifiedContactDisplayName(row);
  return person === "Unbenannt" ? "" : person;
}

export function originallyEmptyContactFields(
  row: UnifiedContactListRow,
): ContactOriginallyEmptyFields {
  return {
    name:
      !row.first_name?.trim() &&
      !row.last_name?.trim() &&
      !row.company?.trim(),
    street: !row.address_street?.trim(),
    zip: !row.address_postal_code?.trim(),
    city: !row.address_city?.trim(),
    country: !row.address_country?.trim(),
    email: row.emails.length === 0,
    phone: row.phones.length === 0,
  };
}

export function recipientFromUnifiedContact(
  row: UnifiedContactListRow,
): AccountingRecipientSnapshot {
  return {
    name: contactRecipientDisplayName(row),
    street: row.address_street,
    zip: row.address_postal_code,
    city: row.address_city,
    countryCode: row.address_country?.trim()
      ? row.address_country.length === 2
        ? row.address_country.toUpperCase()
        : row.address_country.slice(0, 2).toUpperCase()
      : "DE",
    email: row.emails[0] ?? null,
    phone: row.phones[0] ?? null,
  };
}

export function parseRecipientName(name: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "Gast", lastName: "" };
  const space = trimmed.indexOf(" ");
  if (space <= 0) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  };
}

export function collectContactRecipientPatches(
  originallyEmpty: ContactOriginallyEmptyFields,
  recipient: AccountingRecipientSnapshot,
): ContactRecipientFieldKey[] {
  const patches: ContactRecipientFieldKey[] = [];
  if (originallyEmpty.name && recipient.name.trim()) patches.push("name");
  if (originallyEmpty.street && recipient.street?.trim()) patches.push("street");
  if (originallyEmpty.zip && recipient.zip?.trim()) patches.push("zip");
  if (originallyEmpty.city && recipient.city?.trim()) patches.push("city");
  if (originallyEmpty.country && recipient.countryCode?.trim()) {
    patches.push("country");
  }
  if (originallyEmpty.email && recipient.email?.trim()) patches.push("email");
  if (originallyEmpty.phone && recipient.phone?.trim()) patches.push("phone");
  return patches;
}

export function originallyEmptyFromRecipientSnapshot(
  recipient: AccountingRecipientSnapshot,
): ContactOriginallyEmptyFields {
  return {
    name: !recipient.name.trim(),
    street: !recipient.street?.trim(),
    zip: !recipient.zip?.trim(),
    city: !recipient.city?.trim(),
    country: !recipient.countryCode?.trim(),
    email: !recipient.email?.trim(),
    phone: !recipient.phone?.trim(),
  };
}

export function formatContactPatchToast(fields: ContactRecipientFieldKey[]): string {
  return fields.map((f) => CONTACT_RECIPIENT_FIELD_LABELS[f]).join(", ");
}

/** Alle Empfängerfelder editierbar (Neuer Kontakt). */
export const ALL_CONTACT_RECIPIENT_FIELDS_EDITABLE: ContactOriginallyEmptyFields =
  {
    name: true,
    street: true,
    zip: true,
    city: true,
    country: true,
    email: true,
    phone: true,
  };
