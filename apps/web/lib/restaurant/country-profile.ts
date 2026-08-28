import {
  ACCOUNTING_DEFAULT_COUNTRY_CODE,
  ACCOUNTING_DEFAULT_CURRENCY,
  ACCOUNTING_DEFAULT_LOCALE,
  DEFAULT_ACCOUNTING_LOCALE_POLICY,
  type AccountingLocalePolicy,
} from "@/lib/accounting/accounting-locale";
import {
  findCountryByIso2,
  type CountryReference,
} from "@/lib/constants/countries";
import { timezoneFromCountry } from "@/lib/restaurant/restaurant-timezone";

export type SupportedCountryIso2 = "DE" | "AT" | "CH" | "FR";

export type CountryProfileLaborLaw = {
  /** z. B. de-arbzg — ArbZG-Baseline für Gastronomie */
  engineId: string;
  label: string;
};

export type CountryProfile = {
  iso2: SupportedCountryIso2;
  nameDe: string;
  timezone: string;
  accounting: AccountingLocalePolicy;
  /** Quelle für Feiertags-API (Nager.Date) */
  publicHolidaySource: "nager-date";
  /** Plattform-Vertragsvorlagen (country_code) */
  contractTemplatesCountryCode: string;
  /** Compliance-Checklisten (country_code) */
  complianceTemplatesCountryCode: string;
  laborLaw: CountryProfileLaborLaw | null;
  /** Empfohlene Gäste-Sprache (Embed), unabhängig von User-UI-Sprache */
  suggestedGuestDefaultLocale: string;
  legalFieldHints: {
    vatNumberLabel: string;
    commercialRegisterLabel: string;
    legalFormPlaceholder: string;
  };
};

const DE_PROFILE: CountryProfile = {
  iso2: "DE",
  nameDe: "Deutschland",
  timezone: "Europe/Berlin",
  accounting: {
    countryCode: "DE",
    currency: "EUR",
    locale: "de-DE",
    taxRatePresets: DEFAULT_ACCOUNTING_LOCALE_POLICY.taxRatePresets,
  },
  publicHolidaySource: "nager-date",
  contractTemplatesCountryCode: "DE",
  complianceTemplatesCountryCode: "DE",
  laborLaw: { engineId: "de-arbzg", label: "ArbZG (Deutschland, Gastronomie-Baseline)" },
  suggestedGuestDefaultLocale: "de",
  legalFieldHints: {
    vatNumberLabel: "USt-IdNr.",
    commercialRegisterLabel: "Handelsregister / HRB",
    legalFormPlaceholder: "z. B. GmbH",
  },
};

const AT_PROFILE: CountryProfile = {
  ...DE_PROFILE,
  iso2: "AT",
  nameDe: "Österreich",
  timezone: "Europe/Vienna",
  accounting: { ...DE_PROFILE.accounting, countryCode: "AT", locale: "de-AT" },
  contractTemplatesCountryCode: "AT",
  complianceTemplatesCountryCode: "AT",
  laborLaw: null,
  suggestedGuestDefaultLocale: "de",
  legalFieldHints: {
    vatNumberLabel: "UID-Nummer",
    commercialRegisterLabel: "Firmenbuch",
    legalFormPlaceholder: "z. B. GmbH",
  },
};

const CH_PROFILE: CountryProfile = {
  ...DE_PROFILE,
  iso2: "CH",
  nameDe: "Schweiz",
  timezone: "Europe/Zurich",
  accounting: {
    countryCode: "CH",
    currency: "CHF",
    locale: "de-CH",
    taxRatePresets: [],
  },
  contractTemplatesCountryCode: "CH",
  complianceTemplatesCountryCode: "CH",
  laborLaw: null,
  suggestedGuestDefaultLocale: "de",
  legalFieldHints: {
    vatNumberLabel: "UID / MWST-Nr.",
    commercialRegisterLabel: "Handelsregister",
    legalFormPlaceholder: "z. B. GmbH",
  },
};

const FR_PROFILE: CountryProfile = {
  ...DE_PROFILE,
  iso2: "FR",
  nameDe: "Frankreich",
  timezone: "Europe/Paris",
  accounting: { ...DE_PROFILE.accounting, countryCode: "FR", locale: "fr-FR" },
  contractTemplatesCountryCode: "FR",
  complianceTemplatesCountryCode: "FR",
  laborLaw: null,
  suggestedGuestDefaultLocale: "fr",
  legalFieldHints: {
    vatNumberLabel: "N° TVA",
    commercialRegisterLabel: "RCS",
    legalFormPlaceholder: "z. B. SARL",
  },
};

const PROFILES: Record<SupportedCountryIso2, CountryProfile> = {
  DE: DE_PROFILE,
  AT: AT_PROFILE,
  CH: CH_PROFILE,
  FR: FR_PROFILE,
};

export const DEFAULT_COUNTRY_ISO2: SupportedCountryIso2 = "DE";

export function normalizeCountryIso2(
  value: string | null | undefined,
): SupportedCountryIso2 {
  const iso = (value ?? "").trim().toUpperCase();
  if (iso === "AT" || iso === "CH" || iso === "FR") return iso;
  return "DE";
}

export function getCountryProfile(
  iso2: string | null | undefined,
): CountryProfile {
  return PROFILES[normalizeCountryIso2(iso2)];
}

export function countryLabelFromIso2(
  iso2: string,
  countries?: CountryReference[],
): string {
  const ref = findCountryByIso2(iso2, countries);
  return ref?.name_de ?? getCountryProfile(iso2).nameDe;
}

export function resolveRestaurantCountryProfile(params: {
  countryIso2?: string | null;
  countryLabel?: string | null;
}): CountryProfile {
  if (params.countryIso2?.trim()) {
    return getCountryProfile(params.countryIso2);
  }
  const tz = timezoneFromCountry(params.countryLabel ?? "");
  const iso =
    (Object.values(PROFILES).find((p) => p.timezone === tz)?.iso2 as
      | SupportedCountryIso2
      | undefined) ?? DEFAULT_COUNTRY_ISO2;
  return getCountryProfile(iso);
}

export function accountingPolicyForRestaurant(params: {
  countryIso2?: string | null;
  countryLabel?: string | null;
}): AccountingLocalePolicy {
  const profile = resolveRestaurantCountryProfile(params);
  if (profile.accounting.taxRatePresets.length === 0) {
    return {
      countryCode: profile.accounting.countryCode || ACCOUNTING_DEFAULT_COUNTRY_CODE,
      currency: profile.accounting.currency || ACCOUNTING_DEFAULT_CURRENCY,
      locale: profile.accounting.locale || ACCOUNTING_DEFAULT_LOCALE,
      taxRatePresets: [],
    };
  }
  return profile.accounting;
}

export function listSupportedCountryProfiles(): CountryProfile[] {
  return Object.values(PROFILES);
}
