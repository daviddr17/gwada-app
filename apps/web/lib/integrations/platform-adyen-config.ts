export type AdyenPlatformEnv = "test" | "live";

export type PlatformAdyenConfig = {
  env?: AdyenPlatformEnv;
  lem_api_key?: string;
  balance_platform_api_key?: string;
};

export type PlatformAdyenConfigUi = {
  env?: AdyenPlatformEnv;
  lem_api_key_configured?: boolean;
  balance_platform_api_key_configured?: boolean;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export function adyenEnvFromJson(value: unknown): AdyenPlatformEnv {
  return value === "live" ? "live" : "test";
}

export function adyenConfigFromJson(raw: unknown): PlatformAdyenConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    env: adyenEnvFromJson(o.env),
    lem_api_key: str(o.lem_api_key),
    balance_platform_api_key: str(o.balance_platform_api_key),
  };
}

/** Superadmin-UI: keine Klartext-Keys. */
export function adyenConfigToUi(config: PlatformAdyenConfig): PlatformAdyenConfigUi {
  return {
    env: config.env === "live" ? "live" : "test",
    lem_api_key_configured: Boolean(config.lem_api_key?.length),
    balance_platform_api_key_configured: Boolean(
      config.balance_platform_api_key?.length,
    ),
  };
}

export function mergeAdyenPlatformConfig(
  existingRaw: unknown,
  incomingRaw: unknown,
): Record<string, unknown> {
  const existing = adyenConfigFromJson(existingRaw);
  const incomingObj =
    incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw)
      ? (incomingRaw as Record<string, unknown>)
      : {};
  const incoming = adyenConfigFromJson(incomingRaw);
  const base =
    existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)
      ? { ...(existingRaw as Record<string, unknown>) }
      : {};
  delete base.lem_api_key_configured;
  delete base.balance_platform_api_key_configured;

  const lem = incoming.lem_api_key || existing.lem_api_key;
  const balance =
    incoming.balance_platform_api_key || existing.balance_platform_api_key;
  if (lem) base.lem_api_key = lem;
  else delete base.lem_api_key;
  if (balance) base.balance_platform_api_key = balance;
  else delete base.balance_platform_api_key;

  base.env =
    incomingObj.env === "live" || incomingObj.env === "test"
      ? incomingObj.env
      : existing.env ?? "test";
  return base;
}

export function adyenPlatformSecretsReady(config: PlatformAdyenConfig): boolean {
  return Boolean(config.lem_api_key && config.balance_platform_api_key);
}
