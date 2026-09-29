export type PlatformMollieConfig = {
  client_id?: string;
  client_secret?: string;
};

export type PlatformMollieConfigUi = {
  client_id_configured?: boolean;
  client_secret_configured?: boolean;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function mollieConfigFromJson(raw: unknown): PlatformMollieConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    client_id: str(o.client_id),
    client_secret: str(o.client_secret),
  };
}

/** Superadmin-UI: keine Klartext-Secrets. */
export function mollieConfigToUi(
  config: PlatformMollieConfig,
): PlatformMollieConfigUi {
  return {
    client_id_configured: Boolean(config.client_id?.length),
    client_secret_configured: Boolean(config.client_secret?.length),
  };
}

export function mergeMolliePlatformConfig(
  existingRaw: unknown,
  incomingRaw: unknown,
): Record<string, unknown> {
  const existing = mollieConfigFromJson(existingRaw);
  const incoming = mollieConfigFromJson(incomingRaw);
  const base =
    existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)
      ? { ...(existingRaw as Record<string, unknown>) }
      : {};
  delete base.client_id_configured;
  delete base.client_secret_configured;
  delete base.api_key_configured;
  delete base.webhook_secret_configured;

  const clientId = incoming.client_id || existing.client_id;
  const clientSecret = incoming.client_secret || existing.client_secret;
  if (clientId) base.client_id = clientId;
  else delete base.client_id;
  if (clientSecret) base.client_secret = clientSecret;
  else delete base.client_secret;
  return base;
}

export function molliePlatformSecretsReady(
  config: PlatformMollieConfig,
): boolean {
  return Boolean(config.client_id && config.client_secret);
}
