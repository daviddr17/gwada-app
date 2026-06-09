import {
  parseRecipientName,
  type ContactOriginallyEmptyFields,
  type ContactRecipientFieldKey,
} from "@/lib/accounting/accounting-contact-recipient";
import type { AccountingRecipientSnapshot } from "@/lib/types/accounting";
import type { UnifiedContactListRow } from "@/lib/contacts/unified-contact-row";

export async function patchContactFieldsFromAccounting(params: {
  restaurantId: string;
  selectedContact: UnifiedContactListRow;
  originallyEmpty: ContactOriginallyEmptyFields;
  recipient: AccountingRecipientSnapshot;
}): Promise<{
  contactId: string | null;
  updatedFields: ContactRecipientFieldKey[];
  error?: string;
}> {
  const res = await fetch("/api/contacts/patch-fields", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId: params.restaurantId,
      gwadaContactId: params.selectedContact.gwadaContactId,
      lexofficeContactId: params.selectedContact.lexofficeContactId,
      originallyEmpty: params.originallyEmpty,
      recipient: params.recipient,
      base: {
        first_name: params.selectedContact.first_name,
        last_name: params.selectedContact.last_name,
        company: params.selectedContact.company,
        address_street: params.selectedContact.address_street,
        address_postal_code: params.selectedContact.address_postal_code,
        address_city: params.selectedContact.address_city,
        address_country: params.selectedContact.address_country,
        emails: params.selectedContact.emails,
        phones: params.selectedContact.phones,
      },
    }),
  });

  const body = (await res.json()) as {
    error?: string;
    contactId?: string | null;
    updatedFields?: ContactRecipientFieldKey[];
  };

  if (!res.ok) {
    return {
      contactId: null,
      updatedFields: [],
      error: body.error ?? "Kontakt konnte nicht ergänzt werden.",
    };
  }

  return {
    contactId: body.contactId ?? null,
    updatedFields: body.updatedFields ?? [],
  };
}

export async function createContactFromAccountingRecipient(params: {
  restaurantId: string;
  recipient: AccountingRecipientSnapshot;
}): Promise<{
  contactId: string | null;
  error?: string;
}> {
  const { firstName, lastName } = parseRecipientName(params.recipient.name);
  const emails = params.recipient.email?.trim()
    ? [{ email: params.recipient.email.trim(), isPrimary: true }]
    : [];
  const phones = params.recipient.phone?.trim()
    ? [{ phoneDisplay: params.recipient.phone.trim(), isPrimary: true }]
    : [];

  const res = await fetch("/api/contacts/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId: params.restaurantId,
      firstName,
      lastName,
      addressStreet: params.recipient.street ?? null,
      addressPostalCode: params.recipient.zip ?? null,
      addressCity: params.recipient.city ?? null,
      addressCountry: params.recipient.countryCode ?? null,
      emails,
      phones,
    }),
  });

  const body = (await res.json()) as {
    error?: string;
    contactId?: string;
  };

  if (!res.ok) {
    return {
      contactId: null,
      error: body.error ?? "Kontakt konnte nicht angelegt werden.",
    };
  }

  return { contactId: body.contactId ?? null };
}
