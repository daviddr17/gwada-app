export type PlatformWeatherConfig = {
  api_key?: string;
};

export type PlatformWeatherConfigUi = {
  api_key_configured?: boolean;
};

export function weatherConfigFromJson(raw: unknown): PlatformWeatherConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    api_key: str("api_key") ?? str("visual_crossing_api_key"),
  };
}

export function weatherConfigToUi(
  config: PlatformWeatherConfig,
): PlatformWeatherConfigUi {
  return {
    api_key_configured: Boolean(config.api_key?.length),
  };
}

export function mergeWeatherApiKey(
  incoming: string | undefined,
  existing: PlatformWeatherConfig,
): string | undefined {
  const next = incoming?.trim();
  if (next) return next;
  return existing.api_key;
}
