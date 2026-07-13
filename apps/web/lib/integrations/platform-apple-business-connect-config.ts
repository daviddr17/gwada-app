export type PlatformAppleBusinessConnectConfig = {
  issuer_id?: string;
  key_id?: string;
  private_key?: string;
};

export type PlatformAppleBusinessConnectConfigUi = {
  issuer_id?: string;
  key_id?: string;
  private_key_configured?: boolean;
};

export function appleBusinessConnectConfigFromJson(
  raw: unknown,
): PlatformAppleBusinessConnectConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    issuer_id: str("issuer_id"),
    key_id: str("key_id"),
    private_key: str("private_key"),
  };
}

export function appleBusinessConnectConfigToUi(
  config: PlatformAppleBusinessConnectConfig,
): PlatformAppleBusinessConnectConfigUi {
  return {
    issuer_id: config.issuer_id,
    key_id: config.key_id,
    private_key_configured: Boolean(config.private_key?.length),
  };
}

export function mergeAppleBusinessConnectPrivateKey(
  incoming: string | undefined,
  existing: PlatformAppleBusinessConnectConfig,
): string | undefined {
  const next = incoming?.trim();
  if (next) return next;
  return existing.private_key;
}

export type AppleBusinessConnectRestaurantConfig = {
  location_id?: string;
  location_name?: string;
  brand_id?: string;
};

export type AppleBusinessConnectRestaurantConfigPublic = {
  location_id?: string;
  location_name?: string;
  brand_id?: string;
};

export function appleBusinessConnectRestaurantConfigFromJson(
  raw: unknown,
): AppleBusinessConnectRestaurantConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    location_id: str("location_id"),
    location_name: str("location_name"),
    brand_id: str("brand_id"),
  };
}

export function appleBusinessConnectRestaurantConfigToPublic(
  config: AppleBusinessConnectRestaurantConfig,
): AppleBusinessConnectRestaurantConfigPublic {
  return {
    location_id: config.location_id,
    location_name: config.location_name,
    brand_id: config.brand_id,
  };
}
