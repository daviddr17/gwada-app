export type PlatformFiskalyConfig = {
  api_key?: string;
  api_secret?: string;
  sign_de_base_url?: string;
  dsfinvk_base_url?: string;
  ereceipt_base_url?: string;
  env?: "TEST" | "LIVE";
};

export type PlatformFiskalyConfigUi = {
  api_key_configured?: boolean;
  api_secret_configured?: boolean;
  sign_de_base_url?: string;
  dsfinvk_base_url?: string;
  ereceipt_base_url?: string;
  env?: "TEST" | "LIVE";
};

const DEFAULT_SIGN_DE_BASE_URL =
  "https://kassensichv-middleware.fiskaly.com/api/v2";
const DEFAULT_DSFINVK_BASE_URL = "https://dsfinvk.fiskaly.com/api/v1";
const DEFAULT_ERECEIPT_BASE_URL = "https://receipt.fiskaly.com/api/v1";

export function fiskalyConfigFromJson(raw: unknown): PlatformFiskalyConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  const env = str("env");
  return {
    api_key: str("api_key"),
    api_secret: str("api_secret"),
    sign_de_base_url: str("sign_de_base_url") ?? DEFAULT_SIGN_DE_BASE_URL,
    dsfinvk_base_url: str("dsfinvk_base_url") ?? DEFAULT_DSFINVK_BASE_URL,
    ereceipt_base_url: str("ereceipt_base_url") ?? DEFAULT_ERECEIPT_BASE_URL,
    env: env === "LIVE" ? "LIVE" : env === "TEST" ? "TEST" : undefined,
  };
}

export function fiskalyConfigToUi(
  config: PlatformFiskalyConfig,
): PlatformFiskalyConfigUi {
  return {
    api_key_configured: Boolean(config.api_key?.length),
    api_secret_configured: Boolean(config.api_secret?.length),
    sign_de_base_url: config.sign_de_base_url,
    dsfinvk_base_url: config.dsfinvk_base_url,
    ereceipt_base_url: config.ereceipt_base_url,
    env: config.env ?? "TEST",
  };
}

export function mergeFiskalySecretFields(
  incoming: { api_key?: string; api_secret?: string },
  existing: PlatformFiskalyConfig,
): PlatformFiskalyConfig {
  return {
    ...existing,
    api_key: incoming.api_key?.trim() || existing.api_key,
    api_secret: incoming.api_secret?.trim() || existing.api_secret,
  };
}
