import "server-only";

import { fetchPlatformWhatsappWahaConfigAdmin } from "@/lib/supabase/platform-whatsapp-secrets-db";
import {
  countWhatsappSessionsOnServerAdmin,
  getRestaurantWahaServerIdAdmin,
  getWahaServerByIdAdmin,
  listWahaServersAdmin,
  refreshWahaServerCapacityWarningAdmin,
  setRestaurantWahaServerAdmin,
  wahaServerRowToConfig,
} from "@/lib/supabase/waha-servers-db";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import type { WahaServerRow } from "@/lib/waha/waha-server-types";

function configReady(row: WahaServerRow): boolean {
  return Boolean(row.enabled && row.api_key.trim() && row.base_url.trim());
}

/** Legacy-Fallback aus platform_integrations.whatsapp (vor Pool / leerer Pool). */
async function legacyPlatformWahaConfig(): Promise<WahaServerConfig | null> {
  const platform = await fetchPlatformWhatsappWahaConfigAdmin();
  return platform.waha;
}

/**
 * Primärer/Default-Server aus dem Pool (niedrigste sort_order), sonst Legacy.
 * Für Health „irgendein WAHA“ und Call-Sites ohne Restaurant-Kontext.
 */
export async function resolveDefaultWahaServerConfigAdmin(): Promise<WahaServerConfig | null> {
  const servers = await listWahaServersAdmin();
  const ready = servers.filter(configReady);
  if (ready.length > 0) {
    return wahaServerRowToConfig(ready[0]!);
  }
  return legacyPlatformWahaConfig();
}

export async function isWahaPoolConfiguredAdmin(): Promise<boolean> {
  return (await resolveDefaultWahaServerConfigAdmin()) != null;
}

/**
 * Sticky: vorhandene Zuweisung behalten (auch wenn accept_new_sessions=false).
 * Neu: Server mit Luft, der neue Sessions annimmt (wenigste Sessions, dann sort_order).
 */
export async function assignWahaServerForRestaurantAdmin(
  restaurantId: string,
): Promise<{ server: WahaServerRow | null; error: string | null }> {
  const existingId = await getRestaurantWahaServerIdAdmin(restaurantId);
  if (existingId) {
    const existing = await getWahaServerByIdAdmin(existingId);
    if (existing && configReady(existing)) {
      return { server: existing, error: null };
    }
  }

  const servers = (await listWahaServersAdmin()).filter(
    (s) => configReady(s) && s.accept_new_sessions,
  );
  if (servers.length === 0) {
    const legacy = await legacyPlatformWahaConfig();
    if (!legacy) {
      return { server: null, error: "waha_not_configured" };
    }
    // Kein Pool-Server — Caller nutzt Legacy-Config ohne sticky id.
    return { server: null, error: null };
  }

  const scored: Array<{ server: WahaServerRow; count: number }> = [];
  for (const server of servers) {
    const count = await countWhatsappSessionsOnServerAdmin(server.id);
    if (count >= server.session_limit) continue;
    scored.push({ server, count });
  }

  scored.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    if (a.server.sort_order !== b.server.sort_order) {
      return a.server.sort_order - b.server.sort_order;
    }
    return a.server.name.localeCompare(b.server.name, "de");
  });

  const pick = scored[0]?.server;
  if (!pick) {
    return { server: null, error: "waha_pool_full" };
  }

  const { error } = await setRestaurantWahaServerAdmin(restaurantId, pick.id);
  if (error) return { server: null, error };

  await refreshWahaServerCapacityWarningAdmin(pick.id);
  return { server: pick, error: null };
}

export async function resolveWahaConfigForRestaurantAdmin(
  restaurantId: string,
): Promise<WahaServerConfig | null> {
  const { server, error } =
    await assignWahaServerForRestaurantAdmin(restaurantId);
  if (server) {
    return wahaServerRowToConfig(server);
  }
  if (error === "waha_pool_full") {
    console.warn("resolveWahaConfigForRestaurantAdmin: pool full", restaurantId);
    return null;
  }
  // Legacy single-host, solange noch kein Pool-Eintrag existiert.
  return legacyPlatformWahaConfig();
}
