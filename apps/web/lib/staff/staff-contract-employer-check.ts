import type { RestaurantProfile } from "@/lib/types/restaurant";

export type EmployerLegalFieldIssue = {
  key: string;
  label: string;
};

const EMPLOYER_LEGAL_FIELDS: readonly { key: keyof RestaurantProfile; label: string }[] = [
  { key: "legalName", label: "Rechtlicher Name / Firma" },
  { key: "legalRepresentative", label: "Vertreten durch" },
  { key: "street", label: "Straße" },
  { key: "postalCode", label: "PLZ" },
  { key: "city", label: "Ort" },
];

export function listMissingEmployerLegalFields(
  restaurant: RestaurantProfile,
): EmployerLegalFieldIssue[] {
  return EMPLOYER_LEGAL_FIELDS.filter((f) => {
    const value = restaurant[f.key];
    return typeof value !== "string" || !value.trim();
  }).map((f) => ({ key: f.key, label: f.label }));
}
