import { smtpConfigFromJson, smtpConfigToPublic } from "@/lib/integrations/smtp-integration-config";
import {
  whatsappConfigFromJson,
  whatsappConfigToUi,
} from "@/lib/integrations/platform-whatsapp-config";
import {
  fiskalyConfigFromJson,
  fiskalyConfigToUi,
} from "@/lib/integrations/platform-fiskaly-config";
import {
  weatherConfigFromJson,
  weatherConfigToUi,
} from "@/lib/integrations/platform-weather-config";
import {
  tripadvisorConfigFromJson,
  tripadvisorConfigToUi,
} from "@/lib/integrations/platform-tripadvisor-config";
import {
  appleBusinessConnectConfigFromJson,
  appleBusinessConnectConfigToUi,
} from "@/lib/integrations/platform-apple-business-connect-config";
import type { PlatformIntegrationKey } from "@/lib/types/platform-integration";

/** Antwort für Superadmin-UI — niemals Klartext-Secrets. */
export function platformIntegrationConfigForUi(
  key: PlatformIntegrationKey,
  raw: unknown,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  if (key === "whatsapp") {
    return whatsappConfigToUi(whatsappConfigFromJson(raw));
  }

  if (key === "weather") {
    return weatherConfigToUi(weatherConfigFromJson(raw));
  }

  if (key === "tripadvisor") {
    return tripadvisorConfigToUi(tripadvisorConfigFromJson(raw));
  }

  if (key === "apple_business_connect") {
    return appleBusinessConnectConfigToUi(appleBusinessConnectConfigFromJson(raw));
  }

  if (key === "fiskaly") {
    return fiskalyConfigToUi(fiskalyConfigFromJson(raw));
  }

  if (key === "email") {
    return smtpConfigToPublic(smtpConfigFromJson(raw)) as unknown as Record<
      string,
      unknown
    >;
  }

  const o = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...o };
  delete out.client_secret;
  if (typeof o.client_secret === "string" && o.client_secret.length > 0) {
    out.client_secret_configured = true;
  }
  return out;
}
