/** Gespeichert in restaurant_integrations.config (ohne Tokens in API-Responses). */

export type OAuthIntegrationConfigPublic = {
  requested_scopes?: string[];
  granted_scopes?: string[];
  /** ISO-Zeitpunkt der letzten Scope-Prüfung */
  scopes_checked_at?: string;
};

export type MetaOAuthIntegrationConfig = OAuthIntegrationConfigPublic & {
  page_id?: string;
  page_name?: string;
  page_access_token?: string;
  user_access_token?: string;
  instagram_business_account_id?: string;
  instagram_username?: string;
};

export type GoogleBusinessIntegrationConfig = OAuthIntegrationConfigPublic & {
  account_name?: string;
  account_title?: string;
  location_name?: string;
  location_title?: string;
  refresh_token?: string;
  access_token?: string;
};

export function oauthConfigFromJson<T extends OAuthIntegrationConfigPublic>(
  raw: unknown,
): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {} as T;
  }
  const o = raw as Record<string, unknown>;
  const requested = Array.isArray(o.requested_scopes)
    ? o.requested_scopes.filter((s): s is string => typeof s === "string")
    : undefined;
  const granted = Array.isArray(o.granted_scopes)
    ? o.granted_scopes.filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    ...(o as T),
    requested_scopes: requested,
    granted_scopes: granted,
    scopes_checked_at:
      typeof o.scopes_checked_at === "string" ? o.scopes_checked_at : undefined,
  };
}

export function publicOAuthFieldsFromConfig(
  config: OAuthIntegrationConfigPublic,
): Pick<
  OAuthIntegrationConfigPublic,
  "requested_scopes" | "granted_scopes" | "scopes_checked_at"
> {
  return {
    requested_scopes: config.requested_scopes ?? [],
    granted_scopes: config.granted_scopes ?? [],
    scopes_checked_at: config.scopes_checked_at,
  };
}
