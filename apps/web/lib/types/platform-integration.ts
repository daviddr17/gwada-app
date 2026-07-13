import {
  smtpConfigFromJson,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";

export type PlatformIntegrationKey =
  | "google_oauth"
  | "apple_oauth"
  | "facebook"
  | "instagram"
  | "google_business"
  | "whatsapp"
  | "email"
  | "weather"
  | "fiskaly"
  | "lexoffice"
  | "tripadvisor"
  | "apple_business_connect";

export type PlatformIntegrationConfig = {
  client_id?: string;
  client_secret?: string;
  /** Nur in Superadmin-UI — nie Klartext nach dem Laden */
  client_secret_configured?: boolean;
  waha_base_url?: string;
  waha_api_key_configured?: boolean;
  api_key_configured?: boolean;
  passwordConfigured?: boolean;
  /** Apple Sign In: Services ID, Team ID, Key ID, private key PEM, etc. */
  extra?: Record<string, string>;
} & SmtpIntegrationConfig;

export type PlatformIntegrationRow = {
  key: PlatformIntegrationKey;
  enabled: boolean;
  /** Superadmin-UI: Secrets redigiert (siehe platformIntegrationConfigForUi). */
  config: PlatformIntegrationConfig & Record<string, unknown>;
  updated_at: string;
};

export const PLATFORM_INTEGRATION_KEYS: readonly PlatformIntegrationKey[] = [
  "google_oauth",
  "apple_oauth",
  "facebook",
  "instagram",
  "google_business",
  "whatsapp",
  "email",
  "weather",
  "fiskaly",
  "lexoffice",
  "tripadvisor",
  "apple_business_connect",
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
    ...smtpConfigFromJson(raw),
  };
}
