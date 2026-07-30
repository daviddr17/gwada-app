/**
 * SaaS-Abo-Katalog (Free / Basic / Pro) + POS-Add-on.
 * Quelle für Landing, Einstellungen → Abo und Entitlement-Checks.
 */

export const BILLING_PLAN_IDS = ["free", "basic", "pro"] as const;
export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_ADDON_IDS = ["pos"] as const;
export type BillingAddonId = (typeof BILLING_ADDON_IDS)[number];

/** Feature-Keys für Entitlements (nicht dasselbe wie Positions-Permissions). */
export const BILLING_FEATURE_KEYS = [
  "module.menu",
  "module.reservations",
  "module.inventory",
  "module.news",
  "module.events",
  "module.gallery",
  "module.reviews",
  "module.contacts",
  "module.documents",
  "module.checklists",
  "module.staff",
  "module.accounting",
  "module.insights",
  "module.pos",
  "integrations.email",
  "integrations.google_business",
  "integrations.social",
  "integrations.whatsapp",
  "integrations.lexoffice",
  "integrations.tripadvisor",
  "feature.embeds",
  "feature.public_api",
  "feature.displays",
  "feature.news_autopilot",
  "feature.review_auto_reply",
  "feature.compliance",
  "feature.multi_restaurant",
  "feature.priority_support",
  "limit.unlimited_menu",
  "limit.unlimited_reservations",
  "limit.unlimited_staff",
] as const;

export type BillingFeatureKey = (typeof BILLING_FEATURE_KEYS)[number];

export type PlanPrice = {
  monthlyEur: number;
  /** Effektiver Monatspreis bei Jahreszahlung */
  yearlyPerMonthEur: number;
};

export type BillingComparisonRow = {
  id: string;
  label: string;
  hint?: string;
  /** Highlight für „Deal, den man fast nirgends bekommt“ */
  highlight?: boolean;
  free: boolean | string;
  basic: boolean | string;
  pro: boolean | string;
};

const FREE_FEATURES: readonly BillingFeatureKey[] = [
  "module.menu",
  "module.reservations",
  "limit.unlimited_menu",
  "limit.unlimited_reservations",
  "limit.unlimited_staff",
];

const BASIC_FEATURES: readonly BillingFeatureKey[] = [
  ...FREE_FEATURES,
  "module.inventory",
  "module.news",
  "module.events",
  "module.gallery",
  "module.reviews",
  "module.contacts",
  "module.documents",
  "module.checklists",
  "integrations.email",
  "integrations.google_business",
  "feature.embeds",
];

const PRO_FEATURES: readonly BillingFeatureKey[] = [
  ...BASIC_FEATURES,
  "module.staff",
  "module.accounting",
  "module.insights",
  "integrations.social",
  "integrations.whatsapp",
  "integrations.lexoffice",
  "integrations.tripadvisor",
  "feature.public_api",
  "feature.displays",
  "feature.news_autopilot",
  "feature.review_auto_reply",
  "feature.compliance",
  "feature.multi_restaurant",
  "feature.priority_support",
];

export type BillingPlanDefinition = {
  id: BillingPlanId;
  name: string;
  tagline: string;
  /** Kurzer Pitch für Karten */
  pitch: string;
  price: PlanPrice;
  highlight: boolean;
  cta: string;
  features: readonly BillingFeatureKey[];
  /** Bullet-Highlights auf Pricing-Karten */
  cardBullets: readonly string[];
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Zum Durchstarten",
    pitch:
      "Digitale Speisekarte, Reservierungen und eure öffentliche Seite — ohne Seat-Fees.",
    price: { monthlyEur: 0, yearlyPerMonthEur: 0 },
    highlight: false,
    cta: "Kostenlos starten",
    features: FREE_FEATURES,
    cardBullets: [
      "Unbegrenzte Speisen & Kategorien",
      "Unbegrenzte Reservierungen",
      "Unbegrenzte Mitarbeiter (keine Seat-Fees)",
      "Öffentliche Restaurant-Seite",
      "Dashboard, Branding & Öffnungszeiten",
    ],
  },
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Betrieb im Griff",
    pitch:
      "Bestand, Gäste-Kanäle und Content — alles, was den Alltag digital macht.",
    price: { monthlyEur: 19, yearlyPerMonthEur: 15 },
    highlight: false,
    cta: "Basic wählen",
    features: BASIC_FEATURES,
    cardBullets: [
      "Alles aus Free",
      "Bestand & Bestellungen",
      "News, Events, Galerie & Bewertungen",
      "Kontakte + E-Mail-Postfach",
      "Dokumente & Checklisten",
      "Einbetten auf der eigenen Website",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Das volle Restaurant-OS",
    pitch:
      "Schichten, Buchhaltung, WhatsApp, Autopilot, Displays und API — ohne Limits bei Team & Volumen.",
    price: { monthlyEur: 39, yearlyPerMonthEur: 31 },
    highlight: true,
    cta: "Pro wählen",
    features: PRO_FEATURES,
    cardBullets: [
      "Alles aus Basic",
      "Mitarbeiter: Schichten, Zeiten, Verträge",
      "Buchführung + Lexware Office",
      "WhatsApp, Meta & Social-Autopilot",
      "Displays, Insights & Public API",
      "Priorisierter Support",
    ],
  },
};

export type BillingAddonDefinition = {
  id: BillingAddonId;
  name: string;
  tagline: string;
  pitch: string;
  price: PlanPrice;
  feature: BillingFeatureKey;
  cardBullets: readonly string[];
};

export const BILLING_ADDONS: Record<BillingAddonId, BillingAddonDefinition> = {
  pos: {
    id: "pos",
    name: "POS",
    tagline: "Kasse mit TSE",
    pitch:
      "Optionales Add-on zu jedem Plan: Kasse, Fiskalisierung, Quittungen und Zahlungsabwicklung.",
    price: { monthlyEur: 29, yearlyPerMonthEur: 23 },
    feature: "module.pos",
    cardBullets: [
      "Kasse & Handgeräte",
      "TSE / Fiskaly & DSFinV-K",
      "Quittungen, Gutscheine, X-/Z-Berichte",
      "Zahlungsabwicklung (Gast → Restaurant)",
      "Anbindung an Buchführung",
    ],
  },
};

/**
 * Detaillierte Gegenüberstellung für Landing & Abo-Seite.
 * `true` = enthalten, string = Klartext (z. B. „1 Standort“).
 */
export const BILLING_COMPARISON_ROWS: readonly BillingComparisonRow[] = [
  {
    id: "unlimited_staff",
    label: "Unbegrenzte Mitarbeiter",
    hint: "Keine Seat-Fees — zahlt ihr bei den meisten Tools extra.",
    highlight: true,
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "unlimited_reservations",
    label: "Unbegrenzte Reservierungen",
    hint: "Kein Kontingent pro Monat.",
    highlight: true,
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "unlimited_menu",
    label: "Unbegrenzte Speisen & Kategorien",
    highlight: true,
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "public_page",
    label: "Öffentliche Restaurant-Seite",
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "dashboard",
    label: "Dashboard & Branding",
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "reservations_core",
    label: "Reservierungen (Übersicht & Buchung)",
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "floor_plan",
    label: "Tischplan & Kapazität",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "inventory",
    label: "Bestand & Lieferanten",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "news_events_gallery",
    label: "News, Events & Galerie",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "reviews",
    label: "Bewertungen (Gwada + Google)",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "contacts_email",
    label: "Kontakte & E-Mail-Postfach",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "documents",
    label: "Dokumente",
    free: false,
    basic: "3 GB",
    pro: "3 GB",
  },
  {
    id: "checklists",
    label: "Checklisten / To-dos",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "embeds",
    label: "Website-Einbettungen",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "staff_ops",
    label: "Schichtplan, Arbeitszeiten & Verträge",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "accounting",
    label: "Buchführung & Lexware Office",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "whatsapp_social",
    label: "WhatsApp, Facebook & Instagram",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "autopilot",
    label: "News-Autopilot & Bewertungs-Auto-Antworten",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "insights",
    label: "Insights (kanalübergreifend)",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "displays",
    label: "Tablet-Displays (Zeit, Reservierung, …)",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "compliance",
    label: "Eigenkontrolle / HACCP",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "api",
    label: "Public API",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "multi",
    label: "Mehrere Standorte",
    free: "1 Standort",
    basic: "1 Standort",
    pro: "Unbegrenzt",
  },
  {
    id: "support",
    label: "Support",
    free: "Community",
    basic: "E-Mail",
    pro: "Priorisiert",
  },
  {
    id: "pos",
    label: "POS-Kasse (Add-on)",
    hint: "Optional zu jedem Plan — TSE, Quittungen, Gastzahlungen.",
    free: "Add-on",
    basic: "Add-on",
    pro: "Add-on",
  },
];

export function planHasFeature(
  planId: BillingPlanId,
  feature: BillingFeatureKey,
): boolean {
  return BILLING_PLANS[planId].features.includes(feature);
}

export function priceForInterval(
  price: PlanPrice,
  interval: BillingInterval,
): number {
  return interval === "year" ? price.yearlyPerMonthEur : price.monthlyEur;
}

export function yearlyTotalEur(price: PlanPrice): number {
  return price.yearlyPerMonthEur * 12;
}

export function yearlySavingsPercent(price: PlanPrice): number | null {
  if (price.monthlyEur <= 0) return null;
  const full = price.monthlyEur * 12;
  const discounted = yearlyTotalEur(price);
  if (full <= 0) return null;
  return Math.round(((full - discounted) / full) * 100);
}

export function isBillingPlanId(value: string): value is BillingPlanId {
  return (BILLING_PLAN_IDS as readonly string[]).includes(value);
}

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

/** Sidebar-Modul → benötigtes Billing-Feature (null = kein Plan-Gate). */
export const SIDEBAR_MODULE_BILLING_FEATURE: Partial<
  Record<string, BillingFeatureKey>
> = {
  menu: "module.menu",
  reservierungen: "module.reservations",
  inventory: "module.inventory",
  news: "module.news",
  events: "module.events",
  galerie: "module.gallery",
  bewertungen: "module.reviews",
  kontakte: "module.contacts",
  dokumente: "module.documents",
  checklisten: "module.checklists",
  mitarbeiter: "module.staff",
  buchfuehrung: "module.accounting",
  insights: "module.insights",
  pos: "module.pos",
};
