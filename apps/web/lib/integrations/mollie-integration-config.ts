export type MollieIntegrationConfig = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  organization_id?: string;
  profile_id?: string;
  organization_name?: string;
};

export type MollieIntegrationConfigPublic = {
  access_token_configured?: boolean;
  organization_id?: string;
  profile_id?: string;
  organization_name?: string;
};

export function mollieIntegrationConfigFromJson(
  raw: unknown,
): MollieIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    access_token: str("access_token"),
    refresh_token: str("refresh_token"),
    expires_at: str("expires_at"),
    organization_id: str("organization_id"),
    profile_id: str("profile_id"),
    organization_name: str("organization_name"),
  };
}

export function mollieIntegrationConfigToPublic(
  config: MollieIntegrationConfig,
): MollieIntegrationConfigPublic {
  return {
    access_token_configured: Boolean(config.access_token?.length),
    organization_id: config.organization_id,
    profile_id: config.profile_id,
    organization_name: config.organization_name,
  };
}

export function mergeMollieOAuthTokens(
  incoming: MollieIntegrationConfig,
  existing: MollieIntegrationConfig,
): MollieIntegrationConfig {
  return {
    ...existing,
    ...incoming,
    access_token: incoming.access_token || existing.access_token,
    refresh_token: incoming.refresh_token || existing.refresh_token,
  };
}
