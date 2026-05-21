export type PlatformIntegrationKey =
  | "google_oauth"
  | "apple_oauth"
  | "facebook"
  | "instagram"
  | "whatsapp";

export type PlatformIntegrationConfig = {
  client_id?: string;
  client_secret?: string;
  /** Apple Sign In: Services ID, Team ID, Key ID, private key PEM, etc. */
  extra?: Record<string, string>;
};

export type PlatformIntegrationRow = {
  key: PlatformIntegrationKey;
  enabled: boolean;
  config: PlatformIntegrationConfig;
  updated_at: string;
};

export const PLATFORM_INTEGRATION_KEYS: readonly PlatformIntegrationKey[] = [
  "google_oauth",
  "apple_oauth",
  "facebook",
  "instagram",
  "whatsapp",
] as const;

export function integrationConfigFromJson(
  raw: unknown,
): PlatformIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const extra =
    o.extra && typeof o.extra === "object" && !Array.isArray(o.extra)
      ? (o.extra as Record<string, string>)
      : undefined;
  return {
    client_id: typeof o.client_id === "string" ? o.client_id : undefined,
    client_secret:
      typeof o.client_secret === "string" ? o.client_secret : undefined,
    extra,
  };
}
