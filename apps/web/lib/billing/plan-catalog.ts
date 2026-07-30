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

export type BillingComparisonRow =
  | {
      type: "section";
      id: string;
      label: string;
    }
  | {
      type?: "row";
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
  "integrations.google_business",
  "feature.embeds",
  "feature.displays",
];

/** Eigene Absender (E-Mail + WhatsApp) erst ab Pro — Free/Basic nutzen Gwada-Mail. */
const PRO_FEATURES: readonly BillingFeatureKey[] = [
  ...BASIC_FEATURES,
  "module.staff",
  "module.accounting",
  "module.insights",
  "integrations.email",
  "integrations.social",
  "integrations.whatsapp",
  "integrations.lexoffice",
  "integrations.tripadvisor",
  "feature.public_api",
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
      "Unbegrenzte Team-Zugänge (keine Seat-Fees)",
      "Reservierungs-Mails über Gwada",
      "Öffentliche Restaurant-Seite",
    ],
  },
  basic: {
    id: "basic",
    name: "Basic",
    tagline: "Betrieb im Griff",
    pitch:
      "Bestand, Content und Bewertungen — digitaler Alltag, Mails weiter über Gwada.",
    price: { monthlyEur: 49, yearlyPerMonthEur: 39 },
    highlight: false,
    cta: "Basic wählen",
    features: BASIC_FEATURES,
    cardBullets: [
      "Alles aus Free",
      "Reservierungs-Mails über Gwada",
      "Bestand & Bestellungen",
      "News, Events, Galerie & Bewertungen",
      "Kontakte, Dokumente & Checklisten",
      "Tablet-Displays, Einbettungen & Google Business",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Das volle Restaurant-OS",
    pitch:
      "Eigene Absender (E-Mail + WhatsApp), Schichten, Buchhaltung, Autopilot — ohne Limits bei Team & Volumen.",
    price: { monthlyEur: 99, yearlyPerMonthEur: 79 },
    highlight: true,
    cta: "Pro wählen",
    features: PRO_FEATURES,
    cardBullets: [
      "Alles aus Basic",
      "10 GB Workspace-Speicher",
      "Eigener E-Mail-Absender (SMTP/Gmail/Outlook)",
      "WhatsApp, Facebook & Instagram",
      "Mitarbeiter: Schichten, Zeiten, Verträge",
      "Buchführung, Autopilot & API",
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
    price: { monthlyEur: 59, yearlyPerMonthEur: 47 },
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
 * Große Gegenüberstellung für Landing & Einstellungen → Abo.
 * Zeilen müssen zu Features/Gates passen — kein Marketing-Fork.
 */
export const BILLING_COMPARISON_ROWS: readonly BillingComparisonRow[] = [
  { type: "section", id: "sec_limits", label: "Ohne Limits" },
  {
    id: "unlimited_staff",
    label: "Unbegrenzte Team-Zugänge",
    hint: "Keine Seat-Fees — Login/Team ohne Aufpreis pro Person. Das Mitarbeiter-Modul (Schichten …) ist Pro.",
    highlight: true,
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "unlimited_reservations",
    label: "Unbegrenzte Reservierungen",
    hint: "Kein Monatskontingent.",
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
    id: "multi",
    label: "Standorte",
    free: "1",
    basic: "1",
    pro: "Unbegrenzt",
  },

  { type: "section", id: "sec_core", label: "Kern" },
  {
    id: "dashboard",
    label: "Dashboard, Branding & Öffnungszeiten",
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
    id: "menu",
    label: "Speisekarte",
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "reservations",
    label: "Reservierungen inkl. Tischplan",
    hint: "Übersicht, Buchung, Tischplan — im Free-Plan enthalten.",
    free: true,
    basic: true,
    pro: true,
  },

  { type: "section", id: "sec_ops", label: "Betrieb & Gäste" },
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
    label: "Bewertungen (Gwada)",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "google_business",
    label: "Google Business verbinden",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "tripadvisor",
    label: "TripAdvisor verbinden",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "contacts",
    label: "Kontakte",
    free: false,
    basic: true,
    pro: true,
  },
  {
    id: "documents",
    label: "Dokumente & Workspace-Speicher",
    hint: "Gemeinsames Limit für Dokumente, Galerie, News-Medien und Buchführung.",
    free: false,
    basic: "3 GB",
    pro: "10 GB",
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
    id: "displays",
    label: "Tablet-Displays",
    hint: "Zeiterfassung, Reservierungen, Rezepte, …",
    free: false,
    basic: true,
    pro: true,
  },

  { type: "section", id: "sec_channels", label: "Benachrichtigungen & Kanäle" },
  {
    id: "gwada_mail",
    label: "Reservierungs-Mails über Gwada",
    hint: "Versand über die Plattform — kein eigener Absender nötig.",
    free: true,
    basic: true,
    pro: true,
  },
  {
    id: "own_email",
    label: "Eigener E-Mail-Absender",
    hint: "SMTP, Gmail oder Outlook mit eurer Domain.",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "whatsapp",
    label: "WhatsApp verbinden",
    hint: "Eigene Nummer für Gäste-Nachrichten.",
    free: false,
    basic: false,
    pro: true,
  },
  {
    id: "social",
    label: "Facebook & Instagram",
    free: false,
    basic: false,
    pro: true,
  },

  { type: "section", id: "sec_pro", label: "Pro-Power" },
  {
    id: "staff_ops",
    label: "Mitarbeiter: Schichten, Zeiten & Verträge",
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
    id: "support",
    label: "Support",
    free: "Community",
    basic: "E-Mail",
    pro: "Priorisiert",
  },

  { type: "section", id: "sec_pos", label: "Add-on" },
  {
    id: "pos",
    label: "POS-Kasse",
    hint: "Zu jedem Plan zubuchbar — TSE, Quittungen, Gastzahlungen.",
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
