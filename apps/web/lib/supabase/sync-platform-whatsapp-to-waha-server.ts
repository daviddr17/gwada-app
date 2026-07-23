import "server-only";

import {
  normalizeWahaBaseUrl,
  whatsappConfigFromJson,
} from "@/lib/integrations/platform-whatsapp-config";
import {
  createWahaServerAdmin,
  listWahaServersAdmin,
  updateWahaServerAdmin,
} from "@/lib/supabase/waha-servers-db";

/**
 * Nach Speichern von platform_integrations.whatsapp:
 * Primär-Server im Pool anlegen/aktualisieren (gleiche base_url).
 */
export async function syncPlatformWhatsappConfigToWahaServerAdmin(
  config: unknown,
): Promise<void> {
  const cfg = whatsappConfigFromJson(config);
  const baseUrl = cfg.waha_base_url
    ? normalizeWahaBaseUrl(cfg.waha_base_url)
    : "";
  const apiKey = cfg.waha_api_key?.trim() ?? "";
  if (!baseUrl || !apiKey) return;

  const existing = (await listWahaServersAdmin()).find(
    (s) => normalizeWahaBaseUrl(s.base_url) === baseUrl,
  );

  if (existing) {
    await updateWahaServerAdmin(existing.id, {
      base_url: baseUrl,
      api_key: apiKey,
      enabled: true,
    });
    return;
  }

  const servers = await listWahaServersAdmin();
  if (servers.length === 0) {
    await createWahaServerAdmin({
      name: "Primär",
      base_url: baseUrl,
      api_key: apiKey,
      enabled: true,
      accept_new_sessions: true,
      session_limit: 200,
      warn_remaining: 10,
      sort_order: 10,
      notes: "Aus Integrationen → WhatsApp synchronisiert",
    });
    return;
  }

  // Weitere URL: als zusätzlichen Server anlegen
  await createWahaServerAdmin({
    name: `WAHA ${servers.length + 1}`,
    base_url: baseUrl,
    api_key: apiKey,
    enabled: true,
    accept_new_sessions: true,
    session_limit: 200,
    warn_remaining: 10,
    sort_order: 100 + servers.length,
    notes: "Aus Integrationen → WhatsApp synchronisiert",
  });
}
