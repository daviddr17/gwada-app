/** Stammdaten-Felder, die Display anfragen und Dashboard freigeben kann. */
export const STAFF_PROFILE_CHANGE_FIELD_KEYS = [
  "given_name",
  "family_name",
  "birth_date",
  "nationality",
  "address_line1",
  "address_line2",
  "postal_code",
  "city",
  "country",
  "email",
  "phone",
] as const;

export type StaffProfileChangeFieldKey =
  (typeof STAFF_PROFILE_CHANGE_FIELD_KEYS)[number];

export type StaffProfileChangeFields = {
  [K in StaffProfileChangeFieldKey]: string | null;
};

export const STAFF_PROFILE_CHANGE_FIELD_LABELS: Record<
  StaffProfileChangeFieldKey,
  string
> = {
  given_name: "Vorname",
  family_name: "Nachname",
  birth_date: "Geburtsdatum",
  nationality: "Nationalität",
  address_line1: "Straße",
  address_line2: "Adresszusatz",
  postal_code: "PLZ",
  city: "Ort",
  country: "Land",
  email: "E-Mail",
  phone: "Telefon",
};

export type StaffProfileChangeRequestStatus =
  | "pending"
  | "approved"
  | "declined";

export function emptyStaffProfileChangeFields(): StaffProfileChangeFields {
  return {
    given_name: null,
    family_name: null,
    birth_date: null,
    nationality: null,
    address_line1: null,
    address_line2: null,
    postal_code: null,
    city: null,
    country: null,
    email: null,
    phone: null,
  };
}

export function normalizeStaffProfileFieldValue(
  key: StaffProfileChangeFieldKey,
  value: unknown,
): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (key === "birth_date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }
  if (key === "email") {
    return trimmed.toLowerCase();
  }
  if (key === "country") {
    return trimmed.toUpperCase().slice(0, 2);
  }
  return trimmed;
}

export function parseStaffProfileChangeFields(
  raw: unknown,
): StaffProfileChangeFields | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out = emptyStaffProfileChangeFields();
  for (const key of STAFF_PROFILE_CHANGE_FIELD_KEYS) {
    if (!(key in obj)) continue;
    out[key] = normalizeStaffProfileFieldValue(key, obj[key]);
  }
  return out;
}

export function staffProfileFieldsEqual(
  a: StaffProfileChangeFields,
  b: StaffProfileChangeFields,
): boolean {
  return STAFF_PROFILE_CHANGE_FIELD_KEYS.every((key) => a[key] === b[key]);
}

export function formatStaffProfileFieldDisplay(
  key: StaffProfileChangeFieldKey,
  value: string | null,
): string {
  if (value == null || value === "") return "—";
  if (key === "birth_date") {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return value;
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  }
  return value;
}

export type StaffProfileChangeDiffItem = {
  key: StaffProfileChangeFieldKey;
  label: string;
  from: string | null;
  to: string | null;
  fromLabel: string;
  toLabel: string;
};

export function buildStaffProfileChangeDiff(
  previous: StaffProfileChangeFields,
  proposed: StaffProfileChangeFields,
): StaffProfileChangeDiffItem[] {
  const items: StaffProfileChangeDiffItem[] = [];
  for (const key of STAFF_PROFILE_CHANGE_FIELD_KEYS) {
    const from = previous[key];
    const to = proposed[key];
    if (from === to) continue;
    items.push({
      key,
      label: STAFF_PROFILE_CHANGE_FIELD_LABELS[key],
      from,
      to,
      fromLabel: formatStaffProfileFieldDisplay(key, from),
      toLabel: formatStaffProfileFieldDisplay(key, to),
    });
  }
  return items;
}
