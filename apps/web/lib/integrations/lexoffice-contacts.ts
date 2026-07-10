import "server-only";

import {
  LEXOFFICE_API_BASE,
  type LexofficeProfile,
} from "@/lib/integrations/lexoffice-api";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import type { ContactUpsertPayload } from "@/lib/supabase/contacts-db";

export type LexofficeContactPerson = {
  salutation?: string;
  firstName?: string;
  lastName?: string;
  primary?: boolean;
  emailAddress?: string;
  phoneNumber?: string;
};

export type LexofficeContactCompany = {
  name?: string;
  contactPersons?: LexofficeContactPerson[];
};

export type LexofficeContactPersonBlock = {
  salutation?: string;
  firstName?: string;
  lastName?: string;
};

export type LexofficeContactAddress = {
  supplement?: string;
  street?: string;
  zip?: string;
  city?: string;
  countryCode?: string;
};

export type LexofficeContact = {
  id: string;
  organizationId?: string;
  version?: number;
  roles?: {
    customer?: { number?: number };
    vendor?: { number?: number };
  };
  company?: LexofficeContactCompany;
  person?: LexofficeContactPersonBlock;
  addresses?: {
    billing?: LexofficeContactAddress[];
    shipping?: LexofficeContactAddress[];
  };
  emailAddresses?: Partial<
    Record<"business" | "office" | "private" | "other", string[]>
  >;
  phoneNumbers?: Partial<
    Record<
      "business" | "office" | "mobile" | "private" | "fax" | "other",
      string[]
    >
  >;
  note?: string;
  archived?: boolean;
};

type LexofficeContactsPage = {
  content?: LexofficeContact[];
  last?: boolean;
  totalPages?: number;
};

async function lexofficeFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: "API-Key fehlt." };

  let res: Response;
  try {
    res = await fetch(`${LEXOFFICE_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = (await res.json()) as {
        message?: string;
        error?: string;
        title?: string;
      };
      detail =
        body.message?.trim() ||
        body.error?.trim() ||
        body.title?.trim() ||
        null;
    } catch {
      detail = null;
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: detail ?? "Ungültiger oder abgelaufener API-Key.",
        status: res.status,
      };
    }
    return {
      ok: false,
      error: detail ?? `Lexware API (${res.status})`,
      status: res.status,
    };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
}

export async function fetchAllLexofficeContacts(
  apiKey: string,
): Promise<
  | { ok: true; contacts: LexofficeContact[] }
  | { ok: false; error: string; status?: number }
> {
  const all: LexofficeContact[] = [];
  let page = 0;
  let last = false;

  while (!last && page < 100) {
    const result = await lexofficeFetch<LexofficeContactsPage>(
      apiKey,
      `/v1/contacts?page=${page}&size=100`,
    );
    if (!result.ok) return result;
    const batch = result.data.content ?? [];
    all.push(...batch.filter((c) => !c.archived));
    last = result.data.last ?? true;
    page += 1;
    if ((result.data.totalPages ?? 1) <= page) break;
  }

  return { ok: true, contacts: all };
}

export async function createLexofficeContact(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; id: string; version?: number }
  | { ok: false; error: string; status?: number }
> {
  const result = await lexofficeFetch<{
    id?: string;
    version?: number;
  }>(apiKey, "/v1/contacts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) return result;
  if (!result.data.id) {
    return { ok: false, error: "Lexware hat keinen Kontakt angelegt." };
  }
  return { ok: true, id: result.data.id, version: result.data.version };
}

export async function fetchLexofficeContact(
  apiKey: string,
  contactId: string,
): Promise<
  | { ok: true; contact: LexofficeContact }
  | { ok: false; error: string; status?: number }
> {
  const result = await lexofficeFetch<LexofficeContact>(
    apiKey,
    `/v1/contacts/${contactId}`,
  );
  if (!result.ok) return result;
  return { ok: true, contact: result.data };
}

export async function updateLexofficeContact(
  apiKey: string,
  contactId: string,
  payload: Record<string, unknown>,
): Promise<
  | { ok: true; version?: number }
  | { ok: false; error: string; status?: number }
> {
  const result = await lexofficeFetch<{ version?: number }>(
    apiKey,
    `/v1/contacts/${contactId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  if (!result.ok) return result;
  return { ok: true, version: result.data.version };
}

export function gwadaPayloadToLexofficeUpdateBody(
  payload: ContactUpsertPayload,
  existing: LexofficeContact,
): Record<string, unknown> {
  const createBody = gwadaPayloadToLexofficeCreateBody(payload);
  return {
    ...createBody,
    version: existing.version ?? 0,
    roles: existing.roles ?? { customer: {} },
  };
}

export function extractLexofficeEmails(contact: LexofficeContact): string[] {
  const out: string[] = [];
  const groups = contact.emailAddresses;
  if (groups) {
    for (const list of Object.values(groups)) {
      for (const e of list ?? []) {
        if (typeof e === "string" && e.trim()) out.push(e.trim());
      }
    }
  }
  for (const cp of contact.company?.contactPersons ?? []) {
    if (cp.emailAddress?.trim()) out.push(cp.emailAddress.trim());
  }
  return [...new Set(out)];
}

export function extractLexofficePhones(contact: LexofficeContact): string[] {
  const out: string[] = [];
  const groups = contact.phoneNumbers;
  if (groups) {
    for (const list of Object.values(groups)) {
      for (const p of list ?? []) {
        if (typeof p === "string" && p.trim()) out.push(p.trim());
      }
    }
  }
  for (const cp of contact.company?.contactPersons ?? []) {
    if (cp.phoneNumber?.trim()) out.push(cp.phoneNumber.trim());
  }
  return [...new Set(out)];
}

export function lexofficeContactNameParts(contact: LexofficeContact): {
  firstName: string;
  lastName: string;
  company: string | null;
} {
  if (contact.company?.name) {
    const primary =
      contact.company.contactPersons?.find((p) => p.primary) ??
      contact.company.contactPersons?.[0];
    return {
      firstName: primary?.firstName?.trim() ?? "",
      lastName: primary?.lastName?.trim() ?? "",
      company: contact.company.name.trim(),
    };
  }
  if (contact.person) {
    return {
      firstName: contact.person.firstName?.trim() ?? "",
      lastName: contact.person.lastName?.trim() ?? "",
      company: null,
    };
  }
  return { firstName: "", lastName: "", company: null };
}

export function lexofficeContactPrimaryAddress(
  contact: LexofficeContact,
): LexofficeContactAddress | null {
  const billing = contact.addresses?.billing?.[0];
  if (billing) return billing;
  return contact.addresses?.shipping?.[0] ?? null;
}

export function lexofficeContactIdentityKeys(contact: LexofficeContact): {
  emails: string[];
  phones: string[];
} {
  return {
    emails: extractLexofficeEmails(contact)
      .map((e) => normalizeContactEmail(e))
      .filter((e): e is string => Boolean(e)),
    phones: extractLexofficePhones(contact)
      .map((p) => normalizeContactPhone(p))
      .filter((p): p is string => Boolean(p)),
  };
}

export function gwadaPayloadToLexofficeCreateBody(
  payload: ContactUpsertPayload,
): Record<string, unknown> {
  const primaryEmail = payload.emails[0]?.email?.trim();
  const primaryPhone = payload.phones[0]?.phoneDisplay?.trim();
  const address =
    payload.addressStreet ||
    payload.addressPostalCode ||
    payload.addressCity ||
    payload.addressCountry
      ? {
          billing: [
            {
              street: payload.addressStreet?.trim() || undefined,
              zip: payload.addressPostalCode?.trim() || undefined,
              city: payload.addressCity?.trim() || undefined,
              countryCode: payload.addressCountry?.trim()?.slice(0, 2).toUpperCase() || undefined,
            },
          ],
        }
      : undefined;

  const emailAddresses = primaryEmail
    ? { business: [primaryEmail] }
    : undefined;
  const phoneNumbers = primaryPhone
    ? { business: [primaryPhone] }
    : undefined;

  if (payload.company?.trim()) {
    const contactPerson: LexofficeContactPerson = {
      firstName: payload.firstName.trim() || undefined,
      lastName: payload.lastName.trim() || "—",
      primary: true,
      emailAddress: primaryEmail,
      phoneNumber: primaryPhone,
    };
    return {
      version: 0,
      roles: { customer: {} },
      company: {
        name: payload.company.trim(),
        contactPersons: [contactPerson],
      },
      addresses: address,
      emailAddresses,
      phoneNumbers,
      note: payload.notes?.trim() || undefined,
    };
  }

  return {
    version: 0,
    roles: { customer: {} },
    person: {
      firstName: payload.firstName.trim() || undefined,
      lastName: payload.lastName.trim() || "—",
    },
    addresses: address,
    emailAddresses,
    phoneNumbers,
    note: payload.notes?.trim() || undefined,
  };
}

export function lexofficeContactToGwadaDraft(
  contact: LexofficeContact,
): Partial<ContactUpsertPayload> {
  const { firstName, lastName, company } = lexofficeContactNameParts(contact);
  const addr = lexofficeContactPrimaryAddress(contact);
  const emails = extractLexofficeEmails(contact);
  const phones = extractLexofficePhones(contact);

  return {
    firstName: firstName || "Gast",
    lastName,
    company,
    addressStreet: addr?.street ?? null,
    addressPostalCode: addr?.zip ?? null,
    addressCity: addr?.city ?? null,
    addressCountry: addr?.countryCode ?? null,
    notes: contact.note ?? null,
    emails: emails.map((email, i) => ({
      email,
      isPrimary: i === 0,
    })),
    phones: phones.map((phoneDisplay, i) => ({
      phoneDisplay,
      isPrimary: i === 0,
    })),
  };
}

export type LexofficeConnectionContext = {
  apiKey: string;
  profile: LexofficeProfile;
};
