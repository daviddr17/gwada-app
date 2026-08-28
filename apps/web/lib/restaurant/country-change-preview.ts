import type { RestaurantProfile } from "@/lib/types/restaurant";
import {
  countryLabelFromIso2,
  getCountryProfile,
  normalizeCountryIso2,
  type CountryProfile,
} from "@/lib/restaurant/country-profile";
import { timezoneFromCountry } from "@/lib/restaurant/restaurant-timezone";
import type { CountryReference } from "@/lib/constants/countries";

export type CountryChangePreviewRow = {
  key: string;
  label: string;
  before: string;
  after: string;
  /** Nur Anzeige — bestehende Verträge/Zeiten bleiben unverändert */
  informational?: boolean;
};

export function buildCountryChangePreviewRows(params: {
  currentIso2: string;
  nextIso2: string;
  profile: Pick<RestaurantProfile, "defaultLocale">;
  currentTimezone?: string | null;
  countries?: CountryReference[];
}): CountryChangePreviewRow[] {
  const current = getCountryProfile(params.currentIso2);
  const next = getCountryProfile(params.nextIso2);
  if (normalizeCountryIso2(params.currentIso2) === normalizeCountryIso2(params.nextIso2)) {
    return [];
  }

  const rows: CountryChangePreviewRow[] = [
    {
      key: "country",
      label: "Land",
      before: countryLabelFromIso2(current.iso2, params.countries),
      after: countryLabelFromIso2(next.iso2, params.countries),
    },
    {
      key: "timezone",
      label: "Zeitzone",
      before:
        params.currentTimezone?.trim() ||
        timezoneFromCountry(current.nameDe) ||
        current.timezone,
      after: next.timezone,
    },
    {
      key: "holidays",
      label: "Feiertage",
      before: `Kalender ${current.nameDe} (${current.publicHolidaySource})`,
      after: `Kalender ${next.nameDe} (${next.publicHolidaySource})`,
      informational: true,
    },
    {
      key: "accounting-locale",
      label: "Buchhaltungs-Locale",
      before: `${current.accounting.locale} · ${current.accounting.currency}`,
      after: `${next.accounting.locale} · ${next.accounting.currency}`,
    },
    {
      key: "accounting-country",
      label: "Buchhaltungs-Land",
      before: current.accounting.countryCode,
      after: next.accounting.countryCode,
    },
    {
      key: "guest-locale",
      label: "Gäste-Sprache (Vorschlag)",
      before: params.profile.defaultLocale || current.suggestedGuestDefaultLocale,
      after: next.suggestedGuestDefaultLocale,
    },
    {
      key: "contracts",
      label: "Vertragsvorlagen (Import)",
      before: `Plattform-Katalog ${current.contractTemplatesCountryCode}`,
      after: `Plattform-Katalog ${next.contractTemplatesCountryCode}`,
      informational: true,
    },
    {
      key: "compliance",
      label: "Compliance-Checklisten (Import)",
      before: `Vorlagen ${current.complianceTemplatesCountryCode}`,
      after: `Vorlagen ${next.complianceTemplatesCountryCode}`,
      informational: true,
    },
    {
      key: "labor-law",
      label: "Arbeitszeit-Prüfung",
      before: current.laborLaw?.label ?? "Noch nicht verfügbar",
      after: next.laborLaw?.label ?? "Noch nicht verfügbar",
      informational: true,
    },
    {
      key: "vat-label",
      label: "Label USt-/UID-Feld",
      before: current.legalFieldHints.vatNumberLabel,
      after: next.legalFieldHints.vatNumberLabel,
    },
    {
      key: "register-label",
      label: "Label Handelsregister",
      before: current.legalFieldHints.commercialRegisterLabel,
      after: next.legalFieldHints.commercialRegisterLabel,
    },
  ];

  return rows;
}

export function applyCountryProfileToDraft(
  draft: RestaurantProfile,
  nextIso2: string,
  countries?: CountryReference[],
): RestaurantProfile {
  const profile = getCountryProfile(nextIso2);
  return {
    ...draft,
    countryIso2: profile.iso2,
    country: countryLabelFromIso2(profile.iso2, countries),
    defaultLocale: profile.suggestedGuestDefaultLocale,
  };
}
