import type { ContactCatalogPlatform } from "@/lib/constants/contact-catalog-platforms";
import {
  contactAddressLabel,
  contactDisplayName,
  type ContactListRow,
} from "@/lib/supabase/contacts-db";
import type { ContactTagRow } from "@/lib/supabase/contact-tags-db";

export type UnifiedContactListRow = {
  rowKey: string;
  gwadaContactId: string | null;
  lexofficeContactId: string | null;
  platforms: ContactCatalogPlatform[];
  isMerged: boolean;
  first_name: string;
  last_name: string;
  company: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_interaction_at: string | null;
  emails: string[];
  phones: string[];
  reservation_count: number;
  message_count: number;
  tags: ContactTagRow[];
  lexoffice_customer_number: number | null;
};

export function unifiedContactDisplayName(row: UnifiedContactListRow): string {
  return contactDisplayName({
    first_name: row.first_name,
    last_name: row.last_name,
    company: row.company,
  } as ContactListRow);
}

export function unifiedContactAddressLabel(row: UnifiedContactListRow): string {
  return contactAddressLabel({
    address_street: row.address_street,
    address_postal_code: row.address_postal_code,
    address_city: row.address_city,
    address_country: row.address_country,
  } as ContactListRow);
}

/** Label für Kontakt-Combobox: Name, optional mit Adresse (ohne Platzhalter „—“). */
export function unifiedContactOptionLabel(row: UnifiedContactListRow): string {
  const name = unifiedContactDisplayName(row);
  const addr = unifiedContactAddressLabel(row);
  if (addr !== "—") return `${name} — ${addr}`;
  return name;
}

export function filterUnifiedContactsByPlatform(
  rows: UnifiedContactListRow[],
  filter: "all" | ContactCatalogPlatform,
): UnifiedContactListRow[] {
  if (filter === "all") return rows;
  return rows.filter((r) => r.platforms.includes(filter));
}

export function filterUnifiedContactsByTag(
  rows: UnifiedContactListRow[],
  tagFilter: "all" | "__untagged__" | string,
): UnifiedContactListRow[] {
  if (tagFilter === "all") return rows;
  if (tagFilter === "__untagged__") {
    return rows.filter((r) => r.tags.length === 0);
  }
  return rows.filter((r) => r.tags.some((t) => t.id === tagFilter));
}
