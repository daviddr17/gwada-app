/** Bekannte OAuth-Scopes mit deutscher Beschreibung (Meta, Google). */

const GOOGLE_BUSINESS_MANAGE_SCOPE =
  "https://www.googleapis.com/auth/business.manage";

export type IntegrationScopeMeta = {
  id: string;
  label: string;
  /** Kurz: wofür es später in Gwada genutzt werden soll. */
  plannedUse?: string;
  /** Nur UI-Vorschau — wird nicht separat im OAuth-String angefragt. */
  previewOnly?: boolean;
  /** Tatsächlicher OAuth-Scope (falls abweichend von `id`, z. B. bei previewOnly). */
  oauthScopeId?: string;
};

export const META_GRAPH_VERSION = "v22.0";

function oauthId(scope: IntegrationScopeMeta): string {
  return scope.oauthScopeId ?? scope.id;
}

function uniqueOAuthIds(scopes: IntegrationScopeMeta[]): string[] {
  return [...new Set(scopes.filter((s) => !s.previewOnly).map(oauthId))];
}

/** Meta / Facebook Page */
export const FACEBOOK_OAUTH_SCOPES: IntegrationScopeMeta[] = [
  {
    id: "pages_show_list",
    label: "Facebook-Seiten auswählen",
    plannedUse: "Die richtige Restaurant-Seite verknüpfen",
  },
  {
    id: "pages_messaging",
    label: "Messenger-Nachrichten",
    plannedUse: "Nachrichten lesen und beantworten",
  },
  {
    id: "pages_manage_metadata",
    label: "Seiten-Einstellungen & Webhooks",
    plannedUse: "Verbindung stabil halten, Profil-Daten",
  },
  {
    id: "pages_read_engagement",
    label: "Beiträge & Seiten-Feed lesen",
    plannedUse: "Veröffentlichte Inhalte und Engagement abrufen",
  },
  {
    id: "pages_manage_posts",
    label: "Beiträge veröffentlichen",
    plannedUse: "Posts und Updates aus Gwada planen",
  },
  {
    id: "pages_manage_engagement",
    label: "Kommentare, Reaktionen & Bewertungen",
    plannedUse: "Auf Feedback reagieren, Reviews verwalten",
  },
  {
    id: "pages_read_user_content",
    label: "Gäste-Inhalte auf der Seite",
    plannedUse: "Fotos, Erwähnungen und geteilte Inhalte",
  },
];

export const FACEBOOK_OAUTH_SCOPE_IDS = uniqueOAuthIds(FACEBOOK_OAUTH_SCOPES);

/** Meta / Instagram Business (über Facebook-Seite) */
export const INSTAGRAM_OAUTH_SCOPES: IntegrationScopeMeta[] = [
  {
    id: "instagram_basic",
    label: "Instagram-Profil & Medien",
    plannedUse: "Profil, Fotos und Videos anzeigen",
  },
  {
    id: "instagram_manage_messages",
    label: "Instagram Direct-Nachrichten",
    plannedUse: "DMs lesen und senden",
  },
  {
    id: "instagram_content_publish",
    label: "Instagram-Beiträge veröffentlichen",
    plannedUse: "Posts und Karussells aus Gwada posten",
  },
  {
    id: "instagram_manage_comments",
    label: "Instagram-Kommentare",
    plannedUse: "Kommentare lesen und moderieren",
  },
  {
    id: "instagram_manage_contents",
    label: "Instagram-Inhalte verwalten",
    plannedUse: "Beiträge bearbeiten oder entfernen",
  },
  {
    id: "instagram_manage_insights",
    label: "Instagram-Statistiken",
    plannedUse: "Reichweite und Performance auswerten",
  },
  {
    id: "pages_show_list",
    label: "Verknüpfte Facebook-Seite",
    plannedUse: "Instagram Business über die Page verbinden",
  },
  {
    id: "pages_read_engagement",
    label: "Seiten-Zugriff für Instagram",
    plannedUse: "Voraussetzung für Veröffentlichung & Insights",
  },
  {
    id: "business_management",
    label: "Meta Business Manager",
    plannedUse: "Business-Assets dem Restaurant zuordnen",
  },
];

export const INSTAGRAM_OAUTH_SCOPE_IDS = uniqueOAuthIds(INSTAGRAM_OAUTH_SCOPES);

/** Google Business Profile — ein OAuth-Scope, mehrere geplante Funktionen in der UI */
export const GOOGLE_BUSINESS_OAUTH_SCOPES: IntegrationScopeMeta[] = [
  {
    id: GOOGLE_BUSINESS_MANAGE_SCOPE,
    label: "Unternehmensprofil verwalten",
    plannedUse: "Grundlage für alle Google-Business-Funktionen in Gwada",
  },
  {
    id: "gbp:posts",
    label: "Beiträge lesen & veröffentlichen",
    plannedUse: "Local Posts und Updates im Profil",
    previewOnly: true,
    oauthScopeId: GOOGLE_BUSINESS_MANAGE_SCOPE,
  },
  {
    id: "gbp:reviews",
    label: "Bewertungen abrufen & beantworten",
    plannedUse: "Sterne-Bewertungen und Antworten",
    previewOnly: true,
    oauthScopeId: GOOGLE_BUSINESS_MANAGE_SCOPE,
  },
  {
    id: "gbp:messages",
    label: "Kundennachrichten",
    plannedUse: "Nachrichten über Google Business empfangen und senden",
    previewOnly: true,
    oauthScopeId: GOOGLE_BUSINESS_MANAGE_SCOPE,
  },
  {
    id: "gbp:media",
    label: "Fotos & Medien",
    plannedUse: "Profilbilder und Galerie verwalten",
    previewOnly: true,
    oauthScopeId: GOOGLE_BUSINESS_MANAGE_SCOPE,
  },
  {
    id: "gbp:insights",
    label: "Statistiken & Insights",
    plannedUse: "Aufrufe und Interaktionen auswerten",
    previewOnly: true,
    oauthScopeId: GOOGLE_BUSINESS_MANAGE_SCOPE,
  },
];

export const GOOGLE_BUSINESS_OAUTH_SCOPE_IDS = uniqueOAuthIds(
  GOOGLE_BUSINESS_OAUTH_SCOPES,
);

const META_SCOPE_MAP = new Map(
  [...FACEBOOK_OAUTH_SCOPES, ...INSTAGRAM_OAUTH_SCOPES].map((s) => [s.id, s]),
);

const GOOGLE_SCOPE_MAP = new Map(
  GOOGLE_BUSINESS_OAUTH_SCOPES.map((s) => [s.id, s]),
);

export function scopeLabel(
  scopeId: string,
  provider: "meta" | "google",
): string {
  const meta = META_SCOPE_MAP.get(scopeId);
  if (meta) return meta.label;
  if (provider === "google") {
    return GOOGLE_SCOPE_MAP.get(scopeId)?.label ?? scopeId;
  }
  return scopeId;
}

export function scopePlannedUse(
  scopeId: string,
  provider: "meta" | "google",
): string | undefined {
  const meta = META_SCOPE_MAP.get(scopeId);
  if (meta) return meta.plannedUse;
  return GOOGLE_SCOPE_MAP.get(scopeId)?.plannedUse;
}

export function catalogForProvider(
  provider: "facebook" | "instagram" | "google_business",
): IntegrationScopeMeta[] {
  switch (provider) {
    case "facebook":
      return FACEBOOK_OAUTH_SCOPES;
    case "instagram":
      return INSTAGRAM_OAUTH_SCOPES;
    case "google_business":
      return GOOGLE_BUSINESS_OAUTH_SCOPES;
  }
}

/** Scope-IDs für OAuth-Authorize-URL (dedupliziert, ohne reine Vorschau-Zeilen). */
export function oauthScopeIdsForProvider(
  provider: "facebook" | "instagram" | "google_business",
): string[] {
  switch (provider) {
    case "facebook":
      return FACEBOOK_OAUTH_SCOPE_IDS;
    case "instagram":
      return INSTAGRAM_OAUTH_SCOPE_IDS;
    case "google_business":
      return GOOGLE_BUSINESS_OAUTH_SCOPE_IDS;
  }
}

/** Prüft, ob ein Katalog-Eintrag mit den erteilten OAuth-Scopes abgedeckt ist. */
export function isScopeEntryGranted(
  scope: IntegrationScopeMeta,
  grantedOAuthIds: Set<string>,
): boolean {
  return grantedOAuthIds.has(oauthId(scope));
}
