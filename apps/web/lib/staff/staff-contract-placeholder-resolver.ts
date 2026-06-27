import { formatStaffContractDateDe } from "@/lib/staff/staff-contract-period";
import { isStaffFixedPayType } from "@/lib/staff/staff-contract-pay";
import { STAFF_CONTRACT_PLACEHOLDER_GROUPS } from "@/lib/staff/staff-contract-placeholders";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  StaffContractPayType,
} from "@/lib/types/staff";

export type StaffContractPlaceholderField = {
  key: string;
  label: string;
  value: string;
  missing: boolean;
};

export type StaffContractContractDraft = Pick<
  RestaurantStaffContractRow,
  | "valid_from"
  | "valid_to"
  | "pay_type"
  | "hourly_rate_cents"
  | "fixed_salary_cents"
  | "vacation_days_per_year"
  | "target_weekly_minutes"
  | "employment_type_id"
  | "employment_type_name"
>;

function tokenToKey(token: string): string {
  return token.replace(/^\{\{|\}\}$/g, "");
}

const PLACEHOLDER_TOKEN_RE = /\{\{([a-z0-9_.]+)\}\}/gi;

/** Platzhalter-Schlüssel aus Mustertext (Titel, Überschriften, Paragraphen). */
export function extractStaffContractPlaceholderKeys(
  ...texts: string[]
): Set<string> {
  const keys = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const re = new RegExp(PLACEHOLDER_TOKEN_RE.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      keys.add(match[1]!);
    }
  }
  return keys;
}

export function isStaffContractPlaceholderApplicable(
  key: string,
  payType: StaffContractPayType,
): boolean {
  if (key === "vertrag.stundenlohn") return payType === "hourly";
  if (key === "vertrag.festgehalt") return isStaffFixedPayType(payType);
  return true;
}

/** Effektiver Wert: leere Snapshot-Overrides blockieren nicht neu befüllte Stammdaten. */
export function resolveStaffContractPlaceholderValue(
  fields: Record<string, StaffContractPlaceholderField>,
  overrides: Record<string, string> | undefined,
  key: string,
): string {
  const base = fields[key]?.value ?? "";
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, key)) {
    return base;
  }
  const override = overrides[key] ?? "";
  if (!override.trim() && base.trim()) {
    return base;
  }
  return override;
}

function formatEuroCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function staffFullName(staff: RestaurantStaffRow): string {
  return [staff.given_name, staff.family_name].filter(Boolean).join(" ").trim();
}

function staffAddressLine(staff: RestaurantStaffRow): string {
  return [staff.address_line1, staff.address_line2].filter(Boolean).join(", ");
}

function staffPositionLabel(staff: RestaurantStaffRow): string {
  return (
    staff.restaurant_position?.name?.trim() ||
    staff.position_tag?.name?.trim() ||
    ""
  );
}

function paySummary(
  payType: StaffContractPayType,
  hourlyCents: number | null,
  fixedCents: number | null,
): string {
  if (payType === "hourly") {
    const rate = formatEuroCents(hourlyCents);
    return rate ? `Stundenlohn: ${rate}` : "";
  }
  const rate = formatEuroCents(fixedCents);
  if (!rate) return "";
  if (payType === "fixed_weekly") return `Festlohn/Woche: ${rate}`;
  return `Festlohn/Monat: ${rate}`;
}

export function buildStaffContractPlaceholderFields(params: {
  staff: RestaurantStaffRow;
  contract: StaffContractContractDraft;
  restaurant: RestaurantProfile;
  /** Eingeloggter Nutzer, der den Vertrag erstellt / als AG unterschreibt. */
  actingUserFullName?: string;
}): Record<string, StaffContractPlaceholderField> {
  const { staff, contract, restaurant, actingUserFullName } = params;
  const fullName = staffFullName(staff);

  const raw: Record<string, string> = {
    "mitarbeiter.vorname": staff.given_name?.trim() ?? "",
    "mitarbeiter.nachname": staff.family_name?.trim() ?? "",
    "mitarbeiter.name": fullName,
    "mitarbeiter.geburtsdatum": staff.birth_date
      ? formatStaffContractDateDe(staff.birth_date)
      : "",
    "mitarbeiter.nationalitaet": staff.nationality?.trim() ?? "",
    "mitarbeiter.adresse": staffAddressLine(staff),
    "mitarbeiter.plz": staff.postal_code?.trim() ?? "",
    "mitarbeiter.ort": staff.city?.trim() ?? "",
    "mitarbeiter.land": staff.country?.trim() ?? "",
    "mitarbeiter.email": staff.email?.trim() ?? "",
    "mitarbeiter.telefon": staff.phone?.trim() ?? "",
    "mitarbeiter.position": staffPositionLabel(staff),
    "vertrag.beginn": contract.valid_from
      ? formatStaffContractDateDe(contract.valid_from)
      : "",
    "vertrag.ende": contract.valid_to
      ? formatStaffContractDateDe(contract.valid_to)
      : "unbefristet",
    "vertrag.verguetung": paySummary(
      contract.pay_type,
      contract.hourly_rate_cents,
      contract.fixed_salary_cents,
    ),
    "vertrag.stundenlohn":
      contract.pay_type === "hourly"
        ? formatEuroCents(contract.hourly_rate_cents)
        : "",
    "vertrag.festgehalt": isStaffFixedPayType(contract.pay_type)
      ? formatEuroCents(contract.fixed_salary_cents)
      : "",
    "vertrag.urlaubstage":
      contract.vacation_days_per_year != null
        ? String(contract.vacation_days_per_year)
        : "",
    "vertrag.wochenstunden":
      contract.target_weekly_minutes != null
        ? String(Math.round((contract.target_weekly_minutes / 60) * 10) / 10)
        : "",
    "vertrag.beschaeftigungsverhaeltnis":
      contract.employment_type_name?.trim() ?? "",
    "arbeitgeber.erstellt_von": actingUserFullName?.trim() ?? "",
    "restaurant.name": restaurant.name?.trim() ?? "",
    "restaurant.firma": restaurant.legalName?.trim() || restaurant.name?.trim() || "",
    "restaurant.vertreten_durch": restaurant.legalRepresentative?.trim() ?? "",
    "restaurant.rechtsform": restaurant.legalForm?.trim() ?? "",
    "restaurant.handelsregister": restaurant.commercialRegister?.trim() ?? "",
    "restaurant.strasse": restaurant.street?.trim() ?? "",
    "restaurant.plz": restaurant.postalCode?.trim() ?? "",
    "restaurant.ort": restaurant.city?.trim() ?? "",
    "restaurant.land": restaurant.country?.trim() ?? "",
    "restaurant.telefon": restaurant.phone?.trim() ?? "",
    "restaurant.ust_id": restaurant.vatNumber?.trim() ?? "",
  };

  const labelByKey = new Map<string, string>();
  for (const group of STAFF_CONTRACT_PLACEHOLDER_GROUPS) {
    for (const p of group.placeholders) {
      labelByKey.set(tokenToKey(p.token), p.label);
    }
  }

  const fields: Record<string, StaffContractPlaceholderField> = {};
  for (const [key, value] of Object.entries(raw)) {
    fields[key] = {
      key,
      label: labelByKey.get(key) ?? key,
      value,
      missing: !value.trim(),
    };
  }
  return fields;
}

export function replaceStaffContractPlaceholders(
  text: string,
  fields: Record<string, StaffContractPlaceholderField>,
  overrides?: Record<string, string>,
): string {
  let result = text;
  for (const [key] of Object.entries(fields)) {
    const token = `{{${key}}}`;
    const value = resolveStaffContractPlaceholderValue(fields, overrides, key);
    result = result.split(token).join(value);
  }
  return result;
}

export function staffContractPlaceholderValuesMap(
  fields: Record<string, StaffContractPlaceholderField>,
  overrides?: Record<string, string>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    map[key] = resolveStaffContractPlaceholderValue(fields, overrides, key);
  }
  return map;
}

/** Platzhalter-Felder aus Vorlage, gruppiert wie in STAFF_CONTRACT_PLACEHOLDER_GROUPS. */
export function groupStaffContractPlaceholderFields(
  usedKeys: Set<string>,
  fields: Record<string, StaffContractPlaceholderField>,
  payType: StaffContractPayType,
): Array<{ id: string; label: string; items: StaffContractPlaceholderField[] }> {
  const groups: Array<{
    id: string;
    label: string;
    items: StaffContractPlaceholderField[];
  }> = [];

  for (const group of STAFF_CONTRACT_PLACEHOLDER_GROUPS) {
    const items: StaffContractPlaceholderField[] = [];
    for (const placeholder of group.placeholders) {
      const key = tokenToKey(placeholder.token);
      if (!usedKeys.has(key)) continue;
      if (!isStaffContractPlaceholderApplicable(key, payType)) continue;
      const field = fields[key];
      if (field) items.push(field);
    }
    if (items.length > 0) {
      groups.push({ id: group.id, label: group.label, items });
    }
  }

  return groups;
}

export function listMissingStaffContractFields(
  fields: Record<string, StaffContractPlaceholderField>,
  overrides?: Record<string, string>,
  options?: {
    onlyKeys?: Iterable<string>;
    payType?: StaffContractPayType;
  },
): StaffContractPlaceholderField[] {
  const keyFilter = options?.onlyKeys ? new Set(options.onlyKeys) : null;
  const payType = options?.payType;

  return Object.values(fields).filter((f) => {
    if (keyFilter && !keyFilter.has(f.key)) return false;
    if (payType && !isStaffContractPlaceholderApplicable(f.key, payType)) {
      return false;
    }
    const value = resolveStaffContractPlaceholderValue(fields, overrides, f.key);
    return !value.trim();
  });
}
