/** Fallback, wenn `countries`-Tabelle noch nicht migriert oder leer ist. */
export type CountryReference = {
  iso2: string;
  name_de: string;
  dial_code: string;
  flag_emoji: string;
  sort_order: number;
};

export const COUNTRIES_REFERENCE_FALLBACK: CountryReference[] = [
  { iso2: "DE", name_de: "Deutschland", dial_code: "+49", flag_emoji: "🇩🇪", sort_order: 10 },
  { iso2: "AT", name_de: "Österreich", dial_code: "+43", flag_emoji: "🇦🇹", sort_order: 20 },
  { iso2: "CH", name_de: "Schweiz", dial_code: "+41", flag_emoji: "🇨🇭", sort_order: 30 },
  { iso2: "FR", name_de: "Frankreich", dial_code: "+33", flag_emoji: "🇫🇷", sort_order: 40 },
  { iso2: "BE", name_de: "Belgien", dial_code: "+32", flag_emoji: "🇧🇪", sort_order: 50 },
  { iso2: "NL", name_de: "Niederlande", dial_code: "+31", flag_emoji: "🇳🇱", sort_order: 60 },
  { iso2: "LU", name_de: "Luxemburg", dial_code: "+352", flag_emoji: "🇱🇺", sort_order: 70 },
  { iso2: "IT", name_de: "Italien", dial_code: "+39", flag_emoji: "🇮🇹", sort_order: 80 },
  { iso2: "ES", name_de: "Spanien", dial_code: "+34", flag_emoji: "🇪🇸", sort_order: 90 },
  { iso2: "PT", name_de: "Portugal", dial_code: "+351", flag_emoji: "🇵🇹", sort_order: 100 },
  { iso2: "PL", name_de: "Polen", dial_code: "+48", flag_emoji: "🇵🇱", sort_order: 110 },
  { iso2: "CZ", name_de: "Tschechien", dial_code: "+420", flag_emoji: "🇨🇿", sort_order: 120 },
  { iso2: "DK", name_de: "Dänemark", dial_code: "+45", flag_emoji: "🇩🇰", sort_order: 130 },
  { iso2: "SE", name_de: "Schweden", dial_code: "+46", flag_emoji: "🇸🇪", sort_order: 140 },
  { iso2: "NO", name_de: "Norwegen", dial_code: "+47", flag_emoji: "🇳🇴", sort_order: 150 },
  { iso2: "GB", name_de: "Vereinigtes Königreich", dial_code: "+44", flag_emoji: "🇬🇧", sort_order: 160 },
  { iso2: "IE", name_de: "Irland", dial_code: "+353", flag_emoji: "🇮🇪", sort_order: 170 },
  { iso2: "GR", name_de: "Griechenland", dial_code: "+30", flag_emoji: "🇬🇷", sort_order: 180 },
  { iso2: "HU", name_de: "Ungarn", dial_code: "+36", flag_emoji: "🇭🇺", sort_order: 190 },
  { iso2: "RO", name_de: "Rumänien", dial_code: "+40", flag_emoji: "🇷🇴", sort_order: 200 },
  { iso2: "GP", name_de: "Guadeloupe", dial_code: "+590", flag_emoji: "🇬🇵", sort_order: 900 },
  { iso2: "MQ", name_de: "Martinique", dial_code: "+596", flag_emoji: "🇲🇶", sort_order: 910 },
  { iso2: "US", name_de: "USA", dial_code: "+1", flag_emoji: "🇺🇸", sort_order: 920 },
];

const COUNTRY_LABEL_ALIASES: Record<string, string> = {
  deutschland: "DE",
  germany: "DE",
  österreich: "AT",
  osterreich: "AT",
  austria: "AT",
  schweiz: "CH",
  switzerland: "CH",
  france: "FR",
  frankreich: "FR",
  spanien: "ES",
  spain: "ES",
  italien: "IT",
  italy: "IT",
  niederlande: "NL",
  netherlands: "NL",
  belgien: "BE",
  belgium: "BE",
  polen: "PL",
  poland: "PL",
  tschechien: "CZ",
  "czech republic": "CZ",
  czechia: "CZ",
  luxemburg: "LU",
  luxembourg: "LU",
  guadeloupe: "GP",
};

/** Restaurant-Stammdaten (`Deutschland`, `DE`, …) → ISO2 für Standard-Vorwahl. */
export function resolveCountryIso2FromLabel(
  label: string,
  countries: CountryReference[] = COUNTRIES_REFERENCE_FALLBACK,
): string {
  const t = label.trim();
  if (!t) return "DE";
  if (/^[A-Za-z]{2}$/.test(t)) {
    const iso = t.toUpperCase();
    return countries.some((c) => c.iso2 === iso) ? iso : "DE";
  }
  const alias = COUNTRY_LABEL_ALIASES[t.toLowerCase()];
  if (alias) return alias;
  const byName = countries.find(
    (c) => c.name_de.toLowerCase() === t.toLowerCase(),
  );
  return byName?.iso2 ?? "DE";
}

export function findCountryByIso2(
  iso2: string,
  countries: CountryReference[] = COUNTRIES_REFERENCE_FALLBACK,
): CountryReference | undefined {
  return countries.find((c) => c.iso2 === iso2.toUpperCase());
}
