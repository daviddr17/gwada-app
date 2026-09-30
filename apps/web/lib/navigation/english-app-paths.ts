/**
 * Navigable app URLs use English path segments.
 * German bookmarks still resolve: exact aliases, prefix mounts, then segment translation.
 * UI copy is unchanged. API routes are not translated.
 */

export const APP_URL_SEGMENT_EN: Record<string, string> = {
  reservierungen: "reservations",
  kontakte: "contacts",
  bewertungen: "reviews",
  dokumente: "documents",
  checklisten: "tasks",
  mitarbeiter: "staff",
  buchfuehrung: "accounting",
  galerie: "gallery",
  uebersicht: "overview",
  einstellungen: "settings",
  statistiken: "statistics",
  einbinden: "embed",
  protokoll: "log",
  nachrichten: "messages",
  bestellung: "purchase-orders",
  bestellungen: "orders",
  tischplan: "floor-plan",
  schichtplan: "shift-plan",
  vertraege: "contracts",
  arbeitszeiten: "work-hours",
  rechnungen: "invoices",
  angebote: "quotations",
  belege: "vouchers",
  kasse: "cash-book",
  quittungen: "receipts",
  gutscheine: "gift-vouchers",
  berichte: "reports",
  meine: "mine",
  vorlagen: "templates",
  geraete: "devices",
  eintraege: "entries",
  beheben: "fix",
  abrechnung: "payroll",
  oeffnungszeiten: "opening-hours",
  integrationen: "integrations",
  abo: "billing",
  "persoenliche-daten": "personal",
  anmeldung: "sign-in",
  benachrichtigungen: "notifications",
  dienstplan: "schedule",
  verfuegbarkeit: "availability",
  "fiskal-zahlung": "fiscal-payment",
  "drucker-routing": "printer-routing",
  kueche: "kitchen",
  "bestand-storno": "inventory-void",
  "geraete-rechte": "device-permissions",
  allgemein: "general",
  abonnements: "subscriptions",
  warteliste: "waitlist",
  datenbank: "database",
  "lade-strategie": "load-strategy",
  vertragsvorlagen: "contract-templates",
  zahlungen: "payments",
  impressum: "imprint",
  datenschutz: "privacy",
  datenloeschung: "data-deletion",
  agb: "terms",
  avv: "dpa",
  "neues-passwort": "new-password",
  einladung: "invitation",
  bewertung: "review",
  anmelden: "subscribe",
  abmelden: "unsubscribe",
  speisekarte: "menu",
  reservieren: "reserve",
  veranstaltung: "event-inquiry",
  handbuch: "handbook",
  "erste-schritte": "getting-started",
  bestand: "inventory",
  "oeffentliches-profil": "public-profile",
  profil: "profile",
  kontakt: "contact",
};

/** Paths that are not a 1:1 segment rename. Checked before segment translation. */
const EXACT_APP_PATHS: Record<string, string> = {
  "/dashboard/overview": "/dashboard",
  "/dashboard/speisekarte": "/dashboard/menu/overview",
  "/dashboard/nachrichten": "/dashboard/contacts/messages",
  "/dashboard/bestand": "/dashboard/inventory/overview",
  "/dashboard/inventory/export": "/dashboard/inventory/overview",
  "/menu": "/dashboard/menu/overview",
  "/inventory": "/dashboard/inventory/overview",
  "/reservierungen": "/dashboard/reservations/overview",
  "/kontakte": "/dashboard/contacts/messages?platform=all",
  "/bewertungen": "/dashboard/reviews/overview",
  "/dokumente": "/dashboard/documents/overview",
  "/mitarbeiter": "/dashboard/staff/overview",
  "/buchfuehrung": "/dashboard/accounting/invoices",
  "/settings": "/dashboard/settings/restaurant",
  "/profile": "/dashboard/profile/personal",
  "/changelog": "/dashboard/changelog",
  "/dashboard/bewertungen": "/dashboard/reviews/overview",
  "/dashboard/bewertungen/facebook":
    "/dashboard/reviews/overview?platform=facebook",
  "/dashboard/bewertungen/google": "/dashboard/reviews/overview?platform=google",
  "/dashboard/bewertungen/gwada": "/dashboard/reviews/overview?platform=gwada",
  "/dashboard/buchfuehrung": "/dashboard/accounting/invoices",
  "/dashboard/checklisten/eintraege": "/dashboard/tasks/log",
  "/dashboard/checklisten/geraete": "/dashboard/tasks",
  "/dashboard/checklisten/todos": "/dashboard/tasks",
  "/dashboard/checklisten/vorlagen": "/dashboard/tasks",
  "/dashboard/checklisten/eigenkontrolle": "/dashboard/tasks",
  "/dashboard/dokumente": "/dashboard/documents/overview",
  "/dashboard/events": "/dashboard/events/overview",
  "/dashboard/galerie": "/dashboard/gallery/overview",
  "/dashboard/insights": "/dashboard/insights/overview",
  "/dashboard/insights/statistiken": "/dashboard/insights/overview",
  "/dashboard/inventory": "/dashboard/inventory/overview",
  "/dashboard/kontakte": "/dashboard/contacts/messages?platform=all",
  "/dashboard/menu": "/dashboard/menu/overview",
  "/dashboard/mitarbeiter": "/dashboard/staff/overview",
  "/dashboard/mitarbeiter/todos": "/dashboard/tasks",
  "/dashboard/mitarbeiter/todos/protokoll": "/dashboard/tasks/log",
  "/dashboard/news": "/dashboard/news/overview",
  "/dashboard/pos": "/dashboard/pos/overview",
  "/dashboard/pos/einstellungen": "/dashboard/pos/settings/fiscal-payment",
  "/dashboard/profile": "/dashboard/profile/personal",
  "/dashboard/reservierungen": "/dashboard/reservations/overview",
  "/dashboard/settings": "/dashboard/settings/restaurant",
  "/dashboard/settings/branding": "/dashboard/settings/restaurant",
  "/dashboard/settings/rollen": "/dashboard/settings/team",
  "/dashboard/settings/kasse": "/dashboard/pos/settings/fiscal-payment",
  "/dashboard/settings/eigenkontrolle": "/dashboard/tasks",
  "/dashboard/settings/eigenkontrolle/einstellungen": "/dashboard/tasks/settings",
  "/dashboard/settings/eigenkontrolle/eintraege": "/dashboard/tasks/log",
  "/dashboard/settings/eigenkontrolle/geraete": "/dashboard/tasks",
  "/dashboard/settings/eigenkontrolle/protokoll": "/dashboard/tasks/log",
  "/dashboard/settings/eigenkontrolle/vorlagen": "/dashboard/tasks",
  "/settings/eigenkontrolle": "/dashboard/tasks",
  "/settings/eigenkontrolle/einstellungen": "/dashboard/tasks/settings",
  "/settings/eigenkontrolle/eintraege": "/dashboard/tasks/log",
  "/settings/eigenkontrolle/geraete": "/dashboard/tasks",
  "/settings/eigenkontrolle/protokoll": "/dashboard/tasks/log",
  "/settings/eigenkontrolle/vorlagen": "/dashboard/tasks",
  "/checklisten/eintraege": "/dashboard/tasks/log",
  "/checklisten/geraete": "/dashboard/tasks",
  "/checklisten/todos": "/dashboard/tasks",
  "/checklisten/vorlagen": "/dashboard/tasks",
  "/docs/handbuch/speisekarte": "/docs/handbook/menu",
  "/docs/handbuch/bestand": "/docs/handbook/inventory",
  "/docs/handbuch/reservierungen": "/docs/handbook/reservations",
  "/docs/handbuch/nachrichten": "/docs/handbook/messages",
  "/docs/handbuch/bewertungen": "/docs/handbook/reviews",
  "/docs/handbuch/galerie": "/docs/handbook/gallery",
  "/docs/handbuch/buchfuehrung": "/docs/handbook/accounting",
  "/docs/handbuch/dokumente": "/docs/handbook/documents",
  "/docs/handbuch/checklisten": "/docs/handbook/tasks",
  "/docs/handbuch/mitarbeiter": "/docs/handbook/staff",
  "/docs/handbuch/einstellungen": "/docs/handbook/settings",
  "/docs/handbuch/integrationen": "/docs/handbook/integrations",
  "/docs/handbuch/oeffentliches-profil": "/docs/handbook/public-profile",
  "/docs/handbuch/profil": "/docs/handbook/profile",
  "/docs/erste-schritte": "/docs/getting-started",
  "/newsletter/anmelden": "/newsletter/subscribe",
  "/auth/neues-passwort": "/auth/new-password",
  "/impressum": "/imprint",
  "/datenschutz": "/privacy",
  "/datenloeschung": "/data-deletion",
  "/agb": "/terms",
  "/avv": "/dpa",
};

type PrefixRule = { from: string; to: string; keepTail: boolean };

/** Longest prefix first. `from` has no trailing slash. */
const PREFIX_RULES: PrefixRule[] = [
  { from: "/dashboard/speisekarte", to: "/dashboard/menu", keepTail: true },
  {
    from: "/dashboard/nachrichten",
    to: "/dashboard/contacts/messages",
    keepTail: true,
  },
  { from: "/dashboard/bestand", to: "/dashboard/inventory", keepTail: true },
  { from: "/dashboard/mitarbeiter/todos", to: "/dashboard/tasks", keepTail: false },
  {
    from: "/dashboard/settings/eigenkontrolle",
    to: "/dashboard/tasks",
    keepTail: true,
  },
  { from: "/settings/eigenkontrolle", to: "/dashboard/tasks", keepTail: true },
  { from: "/reservierungen", to: "/dashboard/reservations", keepTail: true },
  { from: "/kontakte", to: "/dashboard/contacts", keepTail: true },
  { from: "/bewertungen", to: "/dashboard/reviews", keepTail: true },
  { from: "/dokumente", to: "/dashboard/documents", keepTail: true },
  { from: "/mitarbeiter", to: "/dashboard/staff", keepTail: true },
  { from: "/buchfuehrung", to: "/dashboard/accounting", keepTail: true },
  { from: "/checklisten", to: "/dashboard/tasks", keepTail: true },
  { from: "/galerie", to: "/dashboard/gallery", keepTail: true },
  { from: "/menu", to: "/dashboard/menu", keepTail: true },
  { from: "/inventory", to: "/dashboard/inventory", keepTail: true },
  { from: "/settings", to: "/dashboard/settings", keepTail: true },
  { from: "/profile", to: "/dashboard/profile", keepTail: true },
];

const APP_PATH_ROOTS = new Set([
  "dashboard",
  "superadmin",
  "embed",
  "docs",
  "auth",
  "newsletter",
  "einladung",
  "invitation",
  "bewertung",
  "review",
  "impressum",
  "imprint",
  "datenschutz",
  "privacy",
  "datenloeschung",
  "data-deletion",
  "agb",
  "terms",
  "avv",
  "dpa",
]);

function isSkippableAsset(path: string): boolean {
  if (path.startsWith("/api/") || path === "/api") return true;
  if (path.startsWith("/_next")) return true;
  if (path.startsWith("/sb/") || path === "/sb") return true;
  if (path === "/dashboard/sw.js") return true;
  if (path === "/dashboard/manifest.webmanifest") return true;
  if (path.startsWith("/dashboard/icon/")) return true;
  if (path.startsWith("/dashboard/splash/")) return true;
  return false;
}

function isTranslatableAppPath(path: string): boolean {
  if (isSkippableAsset(path)) return false;
  const root = path.split("/").filter(Boolean)[0];
  return root != null && APP_PATH_ROOTS.has(root);
}

/** Replace German segments. Does not apply legacy aliases. */
export function translatePathSegments(path: string): string {
  if (!isTranslatableAppPath(path)) return path;
  const parts = path.split("/");
  let changed = false;
  const next = parts.map((segment, index) => {
    if (index === 0 || segment.startsWith("[") || segment.startsWith(":")) {
      return segment;
    }
    if (segment === "kasse" && parts[index - 1] === "settings") return segment;
    const mapped = APP_URL_SEGMENT_EN[segment];
    if (mapped && mapped !== segment) {
      changed = true;
      return mapped;
    }
    return segment;
  });
  return changed ? next.join("/") : path;
}

function applyPrefix(path: string): string {
  for (const rule of PREFIX_RULES) {
    if (path === rule.from) return rule.to;
    const prefix = `${rule.from}/`;
    if (!path.startsWith(prefix)) continue;
    if (!rule.keepTail) return rule.to;
    return `${rule.to}/${path.slice(prefix.length)}`;
  }
  return path;
}

function mergeSearch(base: string, extra: string): string {
  const params = new URLSearchParams(base);
  const more = new URLSearchParams(extra);
  for (const [key, value] of more.entries()) {
    if (!params.has(key)) params.append(key, value);
  }
  return params.toString();
}

function splitHref(href: string): {
  path: string;
  search: string;
  hash: string;
  trailingSlash: boolean;
} {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const beforeHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = beforeHash.indexOf("?");
  const search = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  let path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const trailingSlash = path.length > 1 && path.endsWith("/");
  if (trailingSlash) path = path.slice(0, -1);
  return { path, search, hash, trailingSlash };
}

/**
 * Canonical navigable href. External and relative URLs are returned unchanged.
 * Idempotent for paths that are already English.
 */
export function canonicalizeAppHref(href: string): string {
  if (!href.startsWith("/")) return href;
  const { path, search, hash } = splitHref(href);
  if (isSkippableAsset(path)) return href;

  const exact = EXACT_APP_PATHS[path];
  let nextPath = path;
  let nextSearch = search;
  if (exact) {
    const queryIndex = exact.indexOf("?");
    nextPath = queryIndex >= 0 ? exact.slice(0, queryIndex) : exact;
    const exactSearch = queryIndex >= 0 ? exact.slice(queryIndex + 1) : "";
    nextSearch = mergeSearch(exactSearch, search);
  } else {
    nextPath = translatePathSegments(applyPrefix(path));
  }

  if (nextPath === path && nextSearch === search) return href;
  const query = nextSearch ? `?${nextSearch}` : "";
  return `${nextPath}${query}${hash}`;
}

/** Static Next.js redirects for aliases and opaque dynamic tails. */
export const LEGACY_MODULE_REDIRECTS: ReadonlyArray<{
  source: string;
  destination: string;
}> = [
  ...Object.entries(EXACT_APP_PATHS).map(([source, destination]) => ({
    source,
    destination,
  })),
  { source: "/embed/speisekarte/:slug", destination: "/embed/menu/:slug" },
  { source: "/embed/reservieren/:slug", destination: "/embed/reserve/:slug" },
  { source: "/embed/bewertungen/:slug", destination: "/embed/reviews/:slug" },
  {
    source: "/embed/oeffnungszeiten/:slug",
    destination: "/embed/opening-hours/:slug",
  },
  {
    source: "/embed/veranstaltung/:slug",
    destination: "/embed/event-inquiry/:slug",
  },
  { source: "/embed/kontakt/:slug", destination: "/embed/contact/:slug" },
  { source: "/einladung/:token", destination: "/invitation/:token" },
  { source: "/bewertung/:token", destination: "/review/:token" },
  {
    source: "/newsletter/abmelden/:token",
    destination: "/newsletter/unsubscribe/:token",
  },
];
