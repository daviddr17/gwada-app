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
}): Record<string, StaffContractPlaceholderField> {
  const { staff, contract, restaurant } = params;
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
  for (const [key, field] of Object.entries(fields)) {
    const token = `{{${key}}}`;
    const value = overrides?.[key] ?? field.value;
    result = result.split(token).join(value);
  }
  return result;
}

export function staffContractPlaceholderValuesMap(
  fields: Record<string, StaffContractPlaceholderField>,
  overrides?: Record<string, string>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    map[key] = overrides?.[key] ?? field.value;
  }
  return map;
}

export function listMissingStaffContractFields(
  fields: Record<string, StaffContractPlaceholderField>,
  overrides?: Record<string, string>,
): StaffContractPlaceholderField[] {
  return Object.values(fields).filter((f) => {
    const value = overrides?.[f.key] ?? f.value;
    return !value.trim();
  });
}
