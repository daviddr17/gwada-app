import "server-only";

import { mergeSmtpPassword } from "@/lib/integrations/smtp-integration-config";
import {
  mergeWhatsappApiKey,
  normalizeWahaBaseUrl,
  whatsappConfigFromJson,
} from "@/lib/integrations/platform-whatsapp-config";
import type { PlatformIntegrationKey } from "@/lib/types/platform-integration";

export function mergePlatformIntegrationConfig(
  key: PlatformIntegrationKey,
  existingRaw: unknown,
  incomingRaw: unknown,
): Record<string, unknown> {
  const existing =
    existingRaw && typeof existingRaw === "object" && !Array.isArray(existingRaw)
      ? (existingRaw as Record<string, unknown>)
      : {};
  const incoming =
    incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw)
      ? (incomingRaw as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = { ...existing, ...incoming };

  if (key === "whatsapp") {
    const ex = whatsappConfigFromJson(existing);
    const incUrl =
      typeof incoming.waha_base_url === "string"
        ? normalizeWahaBaseUrl(incoming.waha_base_url)
        : ex.waha_base_url;
    merged.waha_base_url = incUrl || undefined;
    const incKey =
      typeof incoming.waha_api_key === "string"
        ? incoming.waha_api_key
        : undefined;
    merged.waha_api_key = mergeWhatsappApiKey(incKey, ex);
    delete merged.waha_baseUrl;
    return merged;
  }

  if (key === "email") {
    const exSmtp = {
      password:
        typeof existing.password === "string" ? existing.password : undefined,
    };
    const incPass =
      typeof incoming.password === "string" ? incoming.password : undefined;
    merged.password = mergeSmtpPassword(incPass, exSmtp);
    return merged;
  }

  const incSecret =
    typeof incoming.client_secret === "string"
      ? incoming.client_secret.trim()
      : "";
  if (incSecret) {
    merged.client_secret = incSecret;
  } else if (typeof existing.client_secret === "string") {
    merged.client_secret = existing.client_secret;
  } else {
    delete merged.client_secret;
  }

  return merged;
}
