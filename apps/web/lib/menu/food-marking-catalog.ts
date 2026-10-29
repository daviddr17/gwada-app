import {
  normalizeCountryIso2,
  type SupportedCountryIso2,
} from "@/lib/restaurant/country-profile";

/** Pflichtkennzeichnung Zusatzstoffe / Allergene (länderspezifische Speisekarten-Liste). */
export type FoodMarkingKind = "additive" | "allergen";

export type FoodMarkingDefinition = {
  /** Stabiler Code in Speisekarte/Zutat (z. B. `a`, `1`). */
  code: string;
  kind: FoodMarkingKind;
  /** Kurzcode für Chip (meist gleich `code`). */
  shortLabel: string;
  /** Anzeigename (Sprache der Länderliste). */
  label: string;
};

const EU_ALLERGENS_DE: FoodMarkingDefinition[] = [
  { code: "1", kind: "allergen", shortLabel: "1", label: "Glutenhaltiges Getreide" },
  { code: "2", kind: "allergen", shortLabel: "2", label: "Krebstiere" },
  { code: "3", kind: "allergen", shortLabel: "3", label: "Eier" },
  { code: "4", kind: "allergen", shortLabel: "4", label: "Fische" },
  { code: "5", kind: "allergen", shortLabel: "5", label: "Erdnüsse" },
  { code: "6", kind: "allergen", shortLabel: "6", label: "Sojabohnen" },
  { code: "7", kind: "allergen", shortLabel: "7", label: "Milch (inkl. Laktose)" },
  { code: "8", kind: "allergen", shortLabel: "8", label: "Schalenfrüchte" },
  { code: "9", kind: "allergen", shortLabel: "9", label: "Sellerie" },
  { code: "10", kind: "allergen", shortLabel: "10", label: "Senf" },
  { code: "11", kind: "allergen", shortLabel: "11", label: "Sesamsamen" },
  {
    code: "12",
    kind: "allergen",
    shortLabel: "12",
    label: "Schwefeldioxid und Sulfite",
  },
  { code: "13", kind: "allergen", shortLabel: "13", label: "Lupinen" },
  { code: "14", kind: "allergen", shortLabel: "14", label: "Weichtiere" },
];

const EU_ALLERGENS_FR: FoodMarkingDefinition[] = [
  { code: "1", kind: "allergen", shortLabel: "1", label: "Céréales contenant du gluten" },
  { code: "2", kind: "allergen", shortLabel: "2", label: "Crustacés" },
  { code: "3", kind: "allergen", shortLabel: "3", label: "Œufs" },
  { code: "4", kind: "allergen", shortLabel: "4", label: "Poissons" },
  { code: "5", kind: "allergen", shortLabel: "5", label: "Arachides" },
  { code: "6", kind: "allergen", shortLabel: "6", label: "Soja" },
  { code: "7", kind: "allergen", shortLabel: "7", label: "Lait (y compris lactose)" },
  { code: "8", kind: "allergen", shortLabel: "8", label: "Fruits à coque" },
  { code: "9", kind: "allergen", shortLabel: "9", label: "Céleri" },
  { code: "10", kind: "allergen", shortLabel: "10", label: "Moutarde" },
  { code: "11", kind: "allergen", shortLabel: "11", label: "Graines de sésame" },
  {
    code: "12",
    kind: "allergen",
    shortLabel: "12",
    label: "Anhydride sulfureux et sulfites",
  },
  { code: "13", kind: "allergen", shortLabel: "13", label: "Lupin" },
  { code: "14", kind: "allergen", shortLabel: "14", label: "Mollusques" },
];

/** DE/AT Gaststätten-Zusatzstoffkennzeichnung (übliche Buchstabenliste). */
const ADDITIVES_DE_AT: FoodMarkingDefinition[] = [
  { code: "a", kind: "additive", shortLabel: "a", label: "mit Farbstoff" },
  { code: "b", kind: "additive", shortLabel: "b", label: "mit Konservierungsstoff" },
  {
    code: "c",
    kind: "additive",
    shortLabel: "c",
    label: "mit Antioxidationsmittel",
  },
  {
    code: "d",
    kind: "additive",
    shortLabel: "d",
    label: "mit Geschmacksverstärker",
  },
  { code: "e", kind: "additive", shortLabel: "e", label: "geschwefelt" },
  { code: "f", kind: "additive", shortLabel: "f", label: "geschwärzt" },
  { code: "g", kind: "additive", shortLabel: "g", label: "gewachst" },
  { code: "h", kind: "additive", shortLabel: "h", label: "mit Phosphat" },
  { code: "i", kind: "additive", shortLabel: "i", label: "mit Süßungsmittel" },
  {
    code: "j",
    kind: "additive",
    shortLabel: "j",
    label: "enthält eine Phenylalaninquelle",
  },
  {
    code: "k",
    kind: "additive",
    shortLabel: "k",
    label: "kann bei übermäßigem Verzehr abführend wirken",
  },
];

const ADDITIVES_CH: FoodMarkingDefinition[] = [
  { code: "a", kind: "additive", shortLabel: "a", label: "mit Farbstoff" },
  { code: "b", kind: "additive", shortLabel: "b", label: "mit Konservierungsstoff" },
  {
    code: "c",
    kind: "additive",
    shortLabel: "c",
    label: "mit Antioxidationsmittel",
  },
  {
    code: "d",
    kind: "additive",
    shortLabel: "d",
    label: "mit Geschmacksverstärker",
  },
  { code: "e", kind: "additive", shortLabel: "e", label: "geschwefelt" },
  { code: "f", kind: "additive", shortLabel: "f", label: "mit Phosphat" },
  { code: "g", kind: "additive", shortLabel: "g", label: "mit Süssstoff" },
  {
    code: "h",
    kind: "additive",
    shortLabel: "h",
    label: "enthält eine Phenylalaninquelle",
  },
];

const ADDITIVES_FR: FoodMarkingDefinition[] = [
  { code: "a", kind: "additive", shortLabel: "a", label: "avec colorant" },
  { code: "b", kind: "additive", shortLabel: "b", label: "avec conservateur" },
  { code: "c", kind: "additive", shortLabel: "c", label: "avec antioxydant" },
  {
    code: "d",
    kind: "additive",
    shortLabel: "d",
    label: "avec exhausteur de goût",
  },
  { code: "e", kind: "additive", shortLabel: "e", label: "sulfité" },
  { code: "f", kind: "additive", shortLabel: "f", label: "avec phosphate" },
  { code: "g", kind: "additive", shortLabel: "g", label: "avec édulcorant" },
  {
    code: "h",
    kind: "additive",
    shortLabel: "h",
    label: "contient une source de phénylalanine",
  },
];

const CATALOG: Record<SupportedCountryIso2, FoodMarkingDefinition[]> = {
  DE: [...ADDITIVES_DE_AT, ...EU_ALLERGENS_DE],
  AT: [...ADDITIVES_DE_AT, ...EU_ALLERGENS_DE],
  CH: [...ADDITIVES_CH, ...EU_ALLERGENS_DE],
  FR: [...ADDITIVES_FR, ...EU_ALLERGENS_FR],
};

export function foodMarkingsForCountry(
  countryIso2: string | null | undefined,
): FoodMarkingDefinition[] {
  return CATALOG[normalizeCountryIso2(countryIso2)];
}

export function foodMarkingByCode(
  countryIso2: string | null | undefined,
  code: string,
): FoodMarkingDefinition | undefined {
  return foodMarkingsForCountry(countryIso2).find((m) => m.code === code);
}

export function foodMarkingLabel(
  countryIso2: string | null | undefined,
  code: string,
): string {
  const m = foodMarkingByCode(countryIso2, code);
  if (!m) return code;
  return `${m.shortLabel} · ${m.label}`;
}

/** Sortierung: Zusatzstoffe (Buchstaben) vor Allergenen (Zahlen). */
export function sortFoodMarkingCodes(
  codes: readonly string[],
  countryIso2: string | null | undefined,
): string[] {
  const order = new Map(
    foodMarkingsForCountry(countryIso2).map((m, i) => [m.code, i]),
  );
  return [...new Set(codes.filter(Boolean))].sort((a, b) => {
    const ia = order.get(a);
    const ib = order.get(b);
    if (ia != null && ib != null) return ia - ib;
    if (ia != null) return -1;
    if (ib != null) return 1;
    return a.localeCompare(b, "de");
  });
}

export function normalizeFoodMarkingCodes(
  raw: unknown,
  countryIso2?: string | null,
): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(
    foodMarkingsForCountry(countryIso2).map((m) => m.code),
  );
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const code = x.trim();
    if (!code) continue;
    if (allowed.size > 0 && !allowed.has(code)) continue;
    if (!out.includes(code)) out.push(code);
  }
  return sortFoodMarkingCodes(out, countryIso2);
}

export function foodMarkingsAsTaxonomy(
  countryIso2: string | null | undefined,
): { id: string; name: string; active: true; backgroundColor: string }[] {
  return foodMarkingsForCountry(countryIso2).map((m) => ({
    id: m.code,
    name: `${m.shortLabel} · ${m.label}`,
    active: true as const,
    backgroundColor: m.kind === "allergen" ? "#fef3c7" : "#e0f2fe",
  }));
}
