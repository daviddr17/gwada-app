import "server-only";

import { mergeSmtpPassword } from "@/lib/integrations/smtp-integration-config";
import {
  mergeWhatsappApiKey,
  normalizeWahaBaseUrl,
  whatsappConfigFromJson,
} from "@/lib/integrations/platform-whatsapp-config";
import {
  mergeFiskalySecretFields,
  fiskalyConfigFromJson,
} from "@/lib/integrations/platform-fiskaly-config";
import {
  mergeWeatherApiKey,
  weatherConfigFromJson,
} from "@/lib/integrations/platform-weather-config";
import {
  mergeTripadvisorApiKey,
  tripadvisorConfigFromJson,
} from "@/lib/integrations/platform-tripadvisor-config";
import {
  mergeAppleBusinessConnectPrivateKey,
  appleBusinessConnectConfigFromJson,
} from "@/lib/integrations/platform-apple-business-connect-config";
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

  if (key === "weather") {
    const ex = weatherConfigFromJson(existing);
    const incKey =
      typeof incoming.api_key === "string" ? incoming.api_key : undefined;
    merged.api_key = mergeWeatherApiKey(incKey, ex);
    delete merged.visual_crossing_api_key;
    return merged;
  }

  if (key === "tripadvisor") {
    const ex = tripadvisorConfigFromJson(existing);
    const incKey =
      typeof incoming.api_key === "string" ? incoming.api_key : undefined;
    merged.api_key = mergeTripadvisorApiKey(incKey, ex);
    delete merged.tripadvisor_api_key;
    return merged;
  }

  if (key === "apple_business_connect") {
    const ex = appleBusinessConnectConfigFromJson(existing);
    if (typeof incoming.issuer_id === "string") {
      merged.issuer_id = incoming.issuer_id.trim() || undefined;
    }
    if (typeof incoming.key_id === "string") {
      merged.key_id = incoming.key_id.trim() || undefined;
    }
    const incKey =
      typeof incoming.private_key === "string" ? incoming.private_key : undefined;
    merged.private_key = mergeAppleBusinessConnectPrivateKey(incKey, ex);
    return merged;
  }

  if (key === "fiskaly") {
    const ex = fiskalyConfigFromJson(existing);
    const withSecrets = mergeFiskalySecretFields(
      {
        api_key:
          typeof incoming.api_key === "string" ? incoming.api_key : undefined,
        api_secret:
          typeof incoming.api_secret === "string"
            ? incoming.api_secret
            : undefined,
      },
      ex,
    );
    const incEnv =
      typeof incoming.env === "string" ? incoming.env.trim() : undefined;
    const env =
      incEnv === "LIVE" ? "LIVE" : incEnv === "TEST" ? "TEST" : ex.env;
    const signDe =
      typeof incoming.sign_de_base_url === "string"
        ? incoming.sign_de_base_url.trim() || undefined
        : ex.sign_de_base_url;
    const dsfinvk =
      typeof incoming.dsfinvk_base_url === "string"
        ? incoming.dsfinvk_base_url.trim() || undefined
        : ex.dsfinvk_base_url;
    const eReceipt =
      typeof incoming.ereceipt_base_url === "string"
        ? incoming.ereceipt_base_url.trim() || undefined
        : ex.ereceipt_base_url;
    return {
      ...withSecrets,
      env: env ?? "TEST",
      sign_de_base_url: signDe,
      dsfinvk_base_url: dsfinvk,
      ereceipt_base_url: eReceipt,
    };
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
