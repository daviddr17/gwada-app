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
