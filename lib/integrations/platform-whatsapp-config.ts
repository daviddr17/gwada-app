export type PlatformWhatsappConfig = {
  waha_base_url?: string;
  waha_api_key?: string;
};

export type PlatformWhatsappConfigUi = {
  waha_base_url?: string;
  waha_api_key_configured?: boolean;
};

export function whatsappConfigFromJson(raw: unknown): PlatformWhatsappConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  const extra =
    o.extra && typeof o.extra === "object" && !Array.isArray(o.extra)
      ? (o.extra as Record<string, unknown>)
      : null;
  const keyFromExtra =
    extra && typeof extra.waha_api_key === "string"
      ? extra.waha_api_key.trim() || undefined
      : undefined;
  return {
    waha_base_url: str("waha_base_url") ?? str("waha_baseUrl") ?? str("base_url"),
    waha_api_key:
      str("waha_api_key") ??
      str("api_key") ??
      keyFromExtra,
  };
}

export function whatsappConfigToUi(
  config: PlatformWhatsappConfig,
): PlatformWhatsappConfigUi {
  return {
    waha_base_url: config.waha_base_url,
    waha_api_key_configured: Boolean(config.waha_api_key?.length),
  };
}

export function mergeWhatsappApiKey(
  incoming: string | undefined,
  existing: PlatformWhatsappConfig,
): string | undefined {
  const next = incoming?.trim();
  if (next) return next;
  return existing.waha_api_key;
}

export function normalizeWahaBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
