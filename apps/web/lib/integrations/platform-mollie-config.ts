export type MolliePlatformMode = "test" | "live";

export type PlatformMollieConfig = {
  /** OAuth app — Connect for restaurant merchants (POS + guest pay). */
  client_id?: string;
  client_secret?: string;
  /** Gwada organization API key — SaaS subscriptions (restaurant → Gwada). */
  api_key?: string;
  /** Optional default profile for Gwada billing payments. */
  profile_id?: string;
  mode?: MolliePlatformMode;
  /**
   * Optional flat application fee (EUR) on Connect guest/POS payments.
   * Empty / 0 = no fee. Mutually exclusive with Resell Pricing per Mollie docs.
   */
  application_fee_eur?: string;
};

export type PlatformMollieConfigUi = {
  client_id_configured?: boolean;
  client_secret_configured?: boolean;
  api_key_configured?: boolean;
  profile_id?: string;
  mode?: MolliePlatformMode;
  application_fee_eur?: string;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function modeFrom(value: unknown): MolliePlatformMode | undefined {
  return value === "live" || value === "test" ? value : undefined;
}

export function mollieConfigFromJson(raw: unknown): PlatformMollieConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    client_id: str(o.client_id),
    client_secret: str(o.client_secret),
    api_key: str(o.api_key),
    profile_id: str(o.profile_id),
    mode: modeFrom(o.mode) ?? (o.api_key?.toString().startsWith("live_") ? "live" : "test"),
    application_fee_eur: str(o.application_fee_eur),
  };
}

/** Superadmin-UI: keine Klartext-Secrets. */
export function mollieConfigToUi(
  config: PlatformMollieConfig,
): PlatformMollieConfigUi {
  return {
    client_id_configured: Boolean(config.client_id?.length),
    client_secret_configured: Boolean(config.client_secret?.length),
    api_key_configured: Boolean(config.api_key?.length),
    profile_id: config.profile_id,
    mode: config.mode ?? "test",
    application_fee_eur: config.application_fee_eur,
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
  const apiKey = incoming.api_key || existing.api_key;
  if (clientId) base.client_id = clientId;
  else delete base.client_id;
  if (clientSecret) base.client_secret = clientSecret;
  else delete base.client_secret;
  if (apiKey) base.api_key = apiKey;
  else delete base.api_key;

  if (incoming.profile_id !== undefined) {
    if (incoming.profile_id) base.profile_id = incoming.profile_id;
    else delete base.profile_id;
  } else if (existing.profile_id) {
    base.profile_id = existing.profile_id;
  }

  const mode = incoming.mode || existing.mode || "test";
  base.mode = mode;

  if (incoming.application_fee_eur !== undefined) {
    if (incoming.application_fee_eur) {
      base.application_fee_eur = incoming.application_fee_eur;
    } else {
      delete base.application_fee_eur;
    }
  } else if (existing.application_fee_eur) {
    base.application_fee_eur = existing.application_fee_eur;
  }

  return base;
}

export function mollieConnectSecretsReady(
  config: PlatformMollieConfig,
): boolean {
  return Boolean(config.client_id && config.client_secret);
}

/** @deprecated use mollieConnectSecretsReady */
export function molliePlatformSecretsReady(
  config: PlatformMollieConfig,
): boolean {
  return mollieConnectSecretsReady(config);
}

export function mollieBillingSecretsReady(
  config: PlatformMollieConfig,
): boolean {
  return Boolean(config.api_key?.startsWith("test_") || config.api_key?.startsWith("live_"));
}

export function mollieApiKeyLooksLikeMode(
  apiKey: string,
  mode: MolliePlatformMode,
): boolean {
  if (mode === "live") return apiKey.startsWith("live_");
  return apiKey.startsWith("test_");
}
