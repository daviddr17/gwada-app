export type PlatformMollieConfig = {
  api_key?: string;
  profile_id?: string;
  webhook_secret?: string;
  client_id?: string;
  client_secret?: string;
};

export type PlatformMollieConfigUi = {
  api_key_configured?: boolean;
  profile_id?: string;
  webhook_secret_configured?: boolean;
  client_id?: string;
  client_secret_configured?: boolean;
};

export function mollieConfigFromJson(raw: unknown): PlatformMollieConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    api_key: str("api_key"),
    profile_id: str("profile_id"),
    webhook_secret: str("webhook_secret"),
    client_id: str("client_id"),
    client_secret: str("client_secret"),
  };
}

export function mollieConfigToUi(
  config: PlatformMollieConfig,
): PlatformMollieConfigUi {
  return {
    api_key_configured: Boolean(config.api_key?.length),
    profile_id: config.profile_id,
    webhook_secret_configured: Boolean(config.webhook_secret?.length),
    client_id: config.client_id,
    client_secret_configured: Boolean(config.client_secret?.length),
  };
}

export function mergeMollieSecretFields(
  incoming: {
    api_key?: string;
    webhook_secret?: string;
    client_secret?: string;
  },
  existing: PlatformMollieConfig,
): PlatformMollieConfig {
  return {
    ...existing,
    api_key: incoming.api_key?.trim() || existing.api_key,
    webhook_secret: incoming.webhook_secret?.trim() || existing.webhook_secret,
    client_secret: incoming.client_secret?.trim() || existing.client_secret,
  };
}
