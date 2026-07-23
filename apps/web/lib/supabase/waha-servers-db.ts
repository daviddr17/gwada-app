import "server-only";

import { normalizeWahaBaseUrl } from "@/lib/integrations/platform-whatsapp-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  WahaServerCapacityAlert,
  WahaServerPublic,
  WahaServerRow,
  WahaSessionListItem,
} from "@/lib/waha/waha-server-types";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import type { SupabaseClient } from "@supabase/supabase-js";

const SERVER_SELECT =
  "id, name, base_url, api_key, enabled, accept_new_sessions, session_limit, warn_remaining, sort_order, notes, last_health_ok_at, last_health_error, capacity_warning_active, capacity_warning_at, created_at, updated_at";

function asServerRow(raw: unknown): WahaServerRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.base_url !== "string") return null;
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "WAHA",
    base_url: r.base_url,
    api_key: typeof r.api_key === "string" ? r.api_key : "",
    enabled: Boolean(r.enabled),
    accept_new_sessions: r.accept_new_sessions !== false,
    session_limit:
      typeof r.session_limit === "number" && r.session_limit > 0
        ? r.session_limit
        : 200,
    warn_remaining:
      typeof r.warn_remaining === "number" && r.warn_remaining >= 0
        ? r.warn_remaining
        : 10,
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 100,
    notes: typeof r.notes === "string" ? r.notes : null,
    last_health_ok_at:
      typeof r.last_health_ok_at === "string" ? r.last_health_ok_at : null,
    last_health_error:
      typeof r.last_health_error === "string" ? r.last_health_error : null,
    capacity_warning_active: Boolean(r.capacity_warning_active),
    capacity_warning_at:
      typeof r.capacity_warning_at === "string" ? r.capacity_warning_at : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
  };
}

export function wahaServerRowToConfig(row: WahaServerRow): WahaServerConfig | null {
  const baseUrl = normalizeWahaBaseUrl(row.base_url);
  const apiKey = row.api_key.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, serverId: row.id };
}

export function wahaServerToPublic(
  row: WahaServerRow,
  sessionCount: number,
): WahaServerPublic {
  const warnThreshold = Math.max(0, row.session_limit - row.warn_remaining);
  return {
    id: row.id,
    name: row.name,
    base_url: normalizeWahaBaseUrl(row.base_url),
    api_key_configured: Boolean(row.api_key.trim()),
    enabled: row.enabled,
    accept_new_sessions: row.accept_new_sessions,
    session_limit: row.session_limit,
    warn_remaining: row.warn_remaining,
    sort_order: row.sort_order,
    notes: row.notes,
    last_health_ok_at: row.last_health_ok_at,
    last_health_error: row.last_health_error,
    capacity_warning_active: row.capacity_warning_active,
    capacity_warning_at: row.capacity_warning_at,
    session_count: sessionCount,
    warn_threshold: warnThreshold,
    near_capacity: sessionCount >= warnThreshold,
    at_capacity: sessionCount >= row.session_limit,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listWahaServersAdmin(
  sb?: SupabaseClient | null,
): Promise<WahaServerRow[]> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from("waha_servers")
    .select(SERVER_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("listWahaServersAdmin", error.message);
    return [];
  }

  return (data ?? []).map(asServerRow).filter((r): r is WahaServerRow => r != null);
}

export async function getWahaServerByIdAdmin(
  serverId: string,
  sb?: SupabaseClient | null,
): Promise<WahaServerRow | null> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from("waha_servers")
    .select(SERVER_SELECT)
    .eq("id", serverId)
    .maybeSingle();

  if (error) {
    console.warn("getWahaServerByIdAdmin", error.message);
    return null;
  }
  return asServerRow(data);
}

export async function countWhatsappSessionsOnServerAdmin(
  serverId: string,
  sb?: SupabaseClient | null,
): Promise<number> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return 0;

  const { count, error } = await client
    .from("restaurant_integrations")
    .select("restaurant_id", { count: "exact", head: true })
    .eq("integration_key", "whatsapp")
    .eq("waha_server_id", serverId);

  if (error) {
    console.warn("countWhatsappSessionsOnServerAdmin", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function countWhatsappSessionsByServerAdmin(
  sb?: SupabaseClient | null,
): Promise<Map<string, number>> {
  const client = sb ?? createSupabaseAdminClient();
  const map = new Map<string, number>();
  if (!client) return map;

  const { data, error } = await client
    .from("restaurant_integrations")
    .select("waha_server_id")
    .eq("integration_key", "whatsapp")
    .not("waha_server_id", "is", null);

  if (error) {
    console.warn("countWhatsappSessionsByServerAdmin", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = (row as { waha_server_id?: string | null }).waha_server_id;
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export async function listWahaServersPublicAdmin(): Promise<WahaServerPublic[]> {
  const servers = await listWahaServersAdmin();
  const counts = await countWhatsappSessionsByServerAdmin();
  return servers.map((s) => wahaServerToPublic(s, counts.get(s.id) ?? 0));
}

export async function listActiveWahaCapacityAlertsAdmin(): Promise<
  WahaServerCapacityAlert[]
> {
  const servers = await listWahaServersPublicAdmin();
  return servers
    .filter((s) => s.enabled && (s.capacity_warning_active || s.near_capacity))
    .map((s) => ({
      server_id: s.id,
      server_name: s.name,
      session_count: s.session_count,
      session_limit: s.session_limit,
      warn_remaining: s.warn_remaining,
      capacity_warning_at: s.capacity_warning_at,
    }));
}

export async function refreshWahaServerCapacityWarningAdmin(
  serverId: string,
  sb?: SupabaseClient | null,
): Promise<void> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return;

  const row = await getWahaServerByIdAdmin(serverId, client);
  if (!row) return;

  const count = await countWhatsappSessionsOnServerAdmin(serverId, client);
  const warnThreshold = Math.max(0, row.session_limit - row.warn_remaining);
  const near = count >= warnThreshold;

  if (near && !row.capacity_warning_active) {
    await client
      .from("waha_servers")
      .update({
        capacity_warning_active: true,
        capacity_warning_at: new Date().toISOString(),
      })
      .eq("id", serverId);
  } else if (!near && row.capacity_warning_active) {
    await client
      .from("waha_servers")
      .update({
        capacity_warning_active: false,
        capacity_warning_at: null,
      })
      .eq("id", serverId);
  }
}

export async function setRestaurantWahaServerAdmin(
  restaurantId: string,
  serverId: string,
  sb?: SupabaseClient | null,
): Promise<{ error: string | null }> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return { error: "server_misconfigured" };

  const { data: existing } = await client
    .from("restaurant_integrations")
    .select("restaurant_id")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", "whatsapp")
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from("restaurant_integrations")
      .update({ waha_server_id: serverId })
      .eq("restaurant_id", restaurantId)
      .eq("integration_key", "whatsapp");
    return { error: error?.message ?? null };
  }

  const { wahaSessionNameForRestaurant } = await import(
    "@/lib/waha/waha-session-name"
  );
  const { error } = await client.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: "whatsapp",
      waha_session_name: wahaSessionNameForRestaurant(restaurantId),
      status: "disconnected",
      waha_server_id: serverId,
    },
    { onConflict: "restaurant_id,integration_key" },
  );
  return { error: error?.message ?? null };
}

export async function getRestaurantWahaServerIdAdmin(
  restaurantId: string,
  sb?: SupabaseClient | null,
): Promise<string | null> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from("restaurant_integrations")
    .select("waha_server_id")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", "whatsapp")
    .maybeSingle();

  if (error) {
    console.warn("getRestaurantWahaServerIdAdmin", error.message);
    return null;
  }
  const id = (data as { waha_server_id?: string | null } | null)?.waha_server_id;
  return typeof id === "string" ? id : null;
}

export async function findRestaurantIdByWahaSessionNameAdmin(
  sessionName: string,
  sb?: SupabaseClient | null,
): Promise<string | null> {
  const client = sb ?? createSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client
    .from("restaurant_integrations")
    .select("restaurant_id")
    .eq("integration_key", "whatsapp")
    .eq("waha_session_name", sessionName)
    .maybeSingle();

  if (error) {
    console.warn("findRestaurantIdByWahaSessionNameAdmin", error.message);
    return null;
  }
  const id = (data as { restaurant_id?: string } | null)?.restaurant_id;
  return typeof id === "string" ? id : null;
}

export async function listWahaSessionsAdmin(): Promise<WahaSessionListItem[]> {
  const client = createSupabaseAdminClient();
  if (!client) return [];

  const { data, error } = await client
    .from("restaurant_integrations")
    .select(
      "restaurant_id, waha_session_name, status, phone_number, display_name, last_error, connected_at, updated_at, waha_server_id",
    )
    .eq("integration_key", "whatsapp")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("listWahaSessionsAdmin", error.message);
    return [];
  }

  const rows = data ?? [];
  const restaurantIds = [
    ...new Set(
      rows
        .map((r) => (r as { restaurant_id?: string }).restaurant_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const serverIds = [
    ...new Set(
      rows
        .map((r) => (r as { waha_server_id?: string | null }).waha_server_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const restaurantMap = new Map<
    string,
    { name: string | null; slug: string | null }
  >();
  if (restaurantIds.length > 0) {
    const { data: restaurants } = await client
      .from("restaurants")
      .select("id, name, slug")
      .in("id", restaurantIds);
    for (const r of restaurants ?? []) {
      const row = r as { id: string; name?: string | null; slug?: string | null };
      restaurantMap.set(row.id, {
        name: row.name ?? null,
        slug: row.slug ?? null,
      });
    }
  }

  const serverMap = new Map<string, string>();
  if (serverIds.length > 0) {
    const { data: servers } = await client
      .from("waha_servers")
      .select("id, name")
      .in("id", serverIds);
    for (const s of servers ?? []) {
      const row = s as { id: string; name?: string };
      serverMap.set(row.id, row.name ?? "WAHA");
    }
  }

  return rows.map((raw) => {
    const r = raw as {
      restaurant_id: string;
      waha_session_name: string;
      status: string;
      phone_number: string | null;
      display_name: string | null;
      last_error: string | null;
      connected_at: string | null;
      updated_at: string;
      waha_server_id: string | null;
    };
    const rest = restaurantMap.get(r.restaurant_id);
    return {
      restaurant_id: r.restaurant_id,
      restaurant_name: rest?.name ?? null,
      restaurant_slug: rest?.slug ?? null,
      waha_session_name: r.waha_session_name,
      status: r.status,
      phone_number: r.phone_number,
      display_name: r.display_name,
      last_error: r.last_error,
      connected_at: r.connected_at,
      updated_at: r.updated_at,
      waha_server_id: r.waha_server_id,
      waha_server_name: r.waha_server_id
        ? (serverMap.get(r.waha_server_id) ?? null)
        : null,
    };
  });
}

export type UpsertWahaServerInput = {
  name: string;
  base_url: string;
  api_key?: string;
  enabled?: boolean;
  accept_new_sessions?: boolean;
  session_limit?: number;
  warn_remaining?: number;
  sort_order?: number;
  notes?: string | null;
};

export async function createWahaServerAdmin(
  input: UpsertWahaServerInput,
): Promise<{ row: WahaServerRow | null; error: string | null }> {
  const client = createSupabaseAdminClient();
  if (!client) return { row: null, error: "server_misconfigured" };

  const baseUrl = normalizeWahaBaseUrl(input.base_url);
  const apiKey = input.api_key?.trim() ?? "";
  if (!input.name.trim()) return { row: null, error: "name_required" };
  if (!baseUrl) return { row: null, error: "base_url_required" };
  if (!apiKey) return { row: null, error: "api_key_required" };

  const { data, error } = await client
    .from("waha_servers")
    .insert({
      name: input.name.trim(),
      base_url: baseUrl,
      api_key: apiKey,
      enabled: input.enabled !== false,
      accept_new_sessions: input.accept_new_sessions !== false,
      session_limit: input.session_limit ?? 200,
      warn_remaining: input.warn_remaining ?? 10,
      sort_order: input.sort_order ?? 100,
      notes: input.notes?.trim() || null,
    })
    .select(SERVER_SELECT)
    .single();

  if (error) return { row: null, error: error.message };
  return { row: asServerRow(data), error: null };
}

export async function updateWahaServerAdmin(
  serverId: string,
  input: Partial<UpsertWahaServerInput> & { clear_capacity_warning?: boolean },
): Promise<{ row: WahaServerRow | null; error: string | null }> {
  const client = createSupabaseAdminClient();
  if (!client) return { row: null, error: "server_misconfigured" };

  const existing = await getWahaServerByIdAdmin(serverId, client);
  if (!existing) return { row: null, error: "not_found" };

  const baseUrl = normalizeWahaBaseUrl(
    (input.base_url ?? existing.base_url).trim() || existing.base_url,
  );
  if (!baseUrl) return { row: null, error: "base_url_required" };

  const nextKey = input.api_key?.trim();
  const apiKey = nextKey || existing.api_key;
  if (!apiKey) return { row: null, error: "api_key_required" };

  const nextName = (input.name ?? existing.name).trim();
  if (!nextName) return { row: null, error: "name_required" };

  const patch: Record<string, unknown> = {
    name: nextName,
    base_url: baseUrl,
    api_key: apiKey,
    enabled: input.enabled ?? existing.enabled,
    accept_new_sessions:
      input.accept_new_sessions ?? existing.accept_new_sessions,
    session_limit: input.session_limit ?? existing.session_limit,
    warn_remaining: input.warn_remaining ?? existing.warn_remaining,
    sort_order: input.sort_order ?? existing.sort_order,
    notes:
      input.notes === undefined
        ? existing.notes
        : input.notes?.trim() || null,
  };

  if (input.clear_capacity_warning) {
    patch.capacity_warning_active = false;
    patch.capacity_warning_at = null;
  }

  const { data, error } = await client
    .from("waha_servers")
    .update(patch)
    .eq("id", serverId)
    .select(SERVER_SELECT)
    .single();

  if (error) return { row: null, error: error.message };
  const row = asServerRow(data);
  if (row) await refreshWahaServerCapacityWarningAdmin(serverId, client);
  return { row, error: null };
}

export async function deleteWahaServerAdmin(
  serverId: string,
): Promise<{ error: string | null }> {
  const client = createSupabaseAdminClient();
  if (!client) return { error: "server_misconfigured" };

  const count = await countWhatsappSessionsOnServerAdmin(serverId, client);
  if (count > 0) {
    return {
      error: "server_has_sessions",
    };
  }

  const { error } = await client.from("waha_servers").delete().eq("id", serverId);
  return { error: error?.message ?? null };
}

export async function updateWahaServerHealthAdmin(
  serverId: string,
  ok: boolean,
  errorMessage?: string | null,
): Promise<void> {
  const client = createSupabaseAdminClient();
  if (!client) return;

  await client
    .from("waha_servers")
    .update(
      ok
        ? {
            last_health_ok_at: new Date().toISOString(),
            last_health_error: null,
          }
        : {
            last_health_error: errorMessage?.trim() || "health_failed",
          },
    )
    .eq("id", serverId);
}
