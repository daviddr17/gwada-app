import "server-only";

import { syncWhatsappFromWaha } from "@/lib/integrations/waha-connect-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getWahaServerByIdAdmin,
  listWahaServersAdmin,
  updateWahaServerHealthAdmin,
  wahaServerRowToConfig,
} from "@/lib/supabase/waha-servers-db";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { triggerWahaContainerRestart } from "@/lib/superadmin/waha-container-restart-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const STUCK_STARTING_MS = 3 * 60 * 1000;
const MAX_SESSION_RECOVERIES_PER_RUN = 25;
const CONTAINER_RESTART_COOLDOWN_MS = 20 * 60 * 1000;

export type WahaSessionRecoverStats = {
  ok: true;
  scanned: number;
  recovered: number;
  failed: number;
  skipped: number;
  containerRestarts: number;
  details: Array<{
    restaurantId: string;
    before: string;
    after: string | null;
    action: "restarted" | "error" | "skipped";
    message?: string;
  }>;
};

function isStuckStarting(status: string, updatedAt: string | null): boolean {
  if (status !== "starting") return false;
  if (!updatedAt) return true;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t >= STUCK_STARTING_MS;
}

async function probeServerHealth(
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/sessions`, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "health_failed",
    };
  }
}

/**
 * Heilt FAILED / gestoppte / hängende STARTING-Sessions via WAHA-API.
 * Bei Host-Ausfall optional Docker-Restart (wenn Container-Name gesetzt).
 */
export async function runWahaSessionRecoverCron(
  admin?: SupabaseClient | null,
  options?: { serverId?: string; forceContainerRestart?: boolean },
): Promise<WahaSessionRecoverStats> {
  const client = admin ?? createSupabaseAdminClient();
  const empty: WahaSessionRecoverStats = {
    ok: true,
    scanned: 0,
    recovered: 0,
    failed: 0,
    skipped: 0,
    containerRestarts: 0,
    details: [],
  };
  if (!client) return empty;

  const servers = await listWahaServersAdmin(client);
  const serverById = new Map(servers.map((s) => [s.id, s]));

  let query = client
    .from("restaurant_integrations")
    .select("restaurant_id, status, updated_at, waha_server_id")
    .eq("integration_key", "whatsapp")
    .in("status", ["failed", "starting", "stopped"]);

  if (options?.serverId) {
    query = query.eq("waha_server_id", options.serverId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .limit(80);

  if (error) {
    console.warn("[waha-recover] list", error.message);
    return empty;
  }

  const candidates = (data ?? []).filter((row) => {
    const status = String((row as { status?: string }).status ?? "");
    const updatedAt =
      typeof (row as { updated_at?: string }).updated_at === "string"
        ? (row as { updated_at: string }).updated_at
        : null;
    if (status === "failed" || status === "stopped") return true;
    return isStuckStarting(status, updatedAt);
  });

  const stats: WahaSessionRecoverStats = {
    ok: true,
    scanned: candidates.length,
    recovered: 0,
    failed: 0,
    skipped: 0,
    containerRestarts: 0,
    details: [],
  };

  const unhealthyServers = new Set<string>();
  let processed = 0;

  for (const raw of candidates) {
    if (processed >= MAX_SESSION_RECOVERIES_PER_RUN) {
      stats.skipped += 1;
      continue;
    }
    const restaurantId = (raw as { restaurant_id?: string }).restaurant_id;
    const before = String((raw as { status?: string }).status ?? "");
    const serverId =
      typeof (raw as { waha_server_id?: string | null }).waha_server_id ===
      "string"
        ? (raw as { waha_server_id: string }).waha_server_id
        : null;

    if (!restaurantId) {
      stats.skipped += 1;
      continue;
    }

    if (serverId) {
      const server = serverById.get(serverId);
      if (server && server.auto_recover_enabled === false) {
        stats.skipped += 1;
        stats.details.push({
          restaurantId,
          before,
          after: null,
          action: "skipped",
          message: "auto_recover_disabled",
        });
        continue;
      }
    }

    processed += 1;
    const waha = await getWahaServerConfigForRestaurantAdmin(restaurantId);
    if (!waha) {
      stats.failed += 1;
      stats.details.push({
        restaurantId,
        before,
        after: null,
        action: "error",
        message: "waha_not_configured",
      });
      continue;
    }

    try {
      const result = await syncWhatsappFromWaha(client, waha, restaurantId, {
        forceRestart: true,
      });
      if (
        result.status === "working" ||
        result.status === "scan_qr" ||
        result.status === "starting"
      ) {
        stats.recovered += 1;
        stats.details.push({
          restaurantId,
          before,
          after: result.status,
          action: "restarted",
        });
      } else {
        stats.failed += 1;
        stats.details.push({
          restaurantId,
          before,
          after: result.status,
          action: "error",
          message: result.message ?? result.status,
        });
        if (waha.serverId) unhealthyServers.add(waha.serverId);
      }
    } catch (e) {
      stats.failed += 1;
      const message = e instanceof Error ? e.message : "recover_failed";
      stats.details.push({
        restaurantId,
        before,
        after: null,
        action: "error",
        message,
      });
      if (waha.serverId) unhealthyServers.add(waha.serverId);
    }
  }

  // Host-Health: alle betroffenen / alle enabled Server prüfen
  const serversToProbe = options?.serverId
    ? servers.filter((s) => s.id === options.serverId)
    : servers.filter((s) => s.enabled && s.auto_recover_enabled !== false);

  for (const server of serversToProbe) {
    const config = wahaServerRowToConfig(server);
    if (!config) continue;
    const health = await probeServerHealth(config.baseUrl, config.apiKey);
    await updateWahaServerHealthAdmin(
      server.id,
      health.ok,
      health.ok ? null : health.error,
    );
    if (!health.ok) unhealthyServers.add(server.id);
  }

  const restartTargets = new Set<string>([
    ...unhealthyServers,
    ...(options?.forceContainerRestart && options.serverId
      ? [options.serverId]
      : []),
  ]);

  for (const serverId of restartTargets) {
    const server = await getWahaServerByIdAdmin(serverId, client);
    if (!server?.docker_container_name?.trim()) continue;
    if (server.auto_recover_enabled === false && !options?.forceContainerRestart) {
      continue;
    }
    if (
      !options?.forceContainerRestart &&
      server.last_container_restart_at
    ) {
      const last = Date.parse(server.last_container_restart_at);
      if (
        Number.isFinite(last) &&
        Date.now() - last < CONTAINER_RESTART_COOLDOWN_MS
      ) {
        continue;
      }
    }

    const triggered = await triggerWahaContainerRestart({
      serverId: server.id,
      containerName: server.docker_container_name.trim(),
      serverName: server.name,
    });
    if (triggered.ok) {
      stats.containerRestarts += 1;
      await client
        .from("waha_servers")
        .update({ last_container_restart_at: new Date().toISOString() })
        .eq("id", server.id);
    }
  }

  return stats;
}
