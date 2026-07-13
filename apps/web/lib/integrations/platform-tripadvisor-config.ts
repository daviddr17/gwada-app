export type PlatformTripadvisorConfig = {
  api_key?: string;
};

export type PlatformTripadvisorConfigUi = {
  api_key_configured?: boolean;
};

export function tripadvisorConfigFromJson(raw: unknown): PlatformTripadvisorConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    api_key: str("api_key") ?? str("tripadvisor_api_key"),
  };
}

export function tripadvisorConfigToUi(
  config: PlatformTripadvisorConfig,
): PlatformTripadvisorConfigUi {
  return {
    api_key_configured: Boolean(config.api_key?.length),
  };
}

export function mergeTripadvisorApiKey(
  incoming: string | undefined,
  existing: PlatformTripadvisorConfig,
): string | undefined {
  const next = incoming?.trim();
  if (next) return next;
  return existing.api_key;
}

export type TripadvisorRestaurantConfig = {
  location_id?: string;
  location_name?: string;
};

export type TripadvisorRestaurantConfigPublic = {
  location_id?: string;
  location_name?: string;
};

export function tripadvisorRestaurantConfigFromJson(
  raw: unknown,
): TripadvisorRestaurantConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    location_id: str("location_id"),
    location_name: str("location_name"),
  };
}

export function tripadvisorRestaurantConfigToPublic(
  config: TripadvisorRestaurantConfig,
): TripadvisorRestaurantConfigPublic {
  return {
    location_id: config.location_id,
    location_name: config.location_name,
  };
}
