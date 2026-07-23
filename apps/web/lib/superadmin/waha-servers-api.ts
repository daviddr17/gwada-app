import type {
  WahaServerCapacityAlert,
  WahaServerPublic,
  WahaSessionListItem,
} from "@/lib/waha/waha-server-types";

export type WahaServersListResponse = {
  servers: WahaServerPublic[];
  capacityAlerts: WahaServerCapacityAlert[];
};

export async function fetchSuperadminWahaServers(): Promise<
  WahaServersListResponse & { error?: string }
> {
  const res = await fetch("/api/superadmin/waha/servers", {
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as WahaServersListResponse & {
    error?: string;
  };
  if (!res.ok) {
    return { servers: [], capacityAlerts: [], error: body.error ?? `http_${res.status}` };
  }
  return {
    servers: body.servers ?? [],
    capacityAlerts: body.capacityAlerts ?? [],
  };
}

export async function fetchSuperadminWahaSessions(): Promise<{
  sessions: WahaSessionListItem[];
  error?: string;
}> {
  const res = await fetch("/api/superadmin/waha/sessions", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as {
    sessions?: WahaSessionListItem[];
    error?: string;
  };
  if (!res.ok) {
    return { sessions: [], error: body.error ?? `http_${res.status}` };
  }
  return { sessions: body.sessions ?? [] };
}

export type WahaServerWriteInput = {
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

export async function createSuperadminWahaServer(
  input: WahaServerWriteInput,
): Promise<{ server?: WahaServerPublic; error?: string }> {
  const res = await fetch("/api/superadmin/waha/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    server?: WahaServerPublic;
    error?: string;
  };
  if (!res.ok) return { error: body.error ?? `http_${res.status}` };
  return { server: body.server };
}

export async function updateSuperadminWahaServer(
  id: string,
  input: WahaServerWriteInput & { clear_capacity_warning?: boolean },
): Promise<{ server?: WahaServerPublic; error?: string }> {
  const res = await fetch(`/api/superadmin/waha/servers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    server?: WahaServerPublic;
    error?: string;
  };
  if (!res.ok) return { error: body.error ?? `http_${res.status}` };
  return { server: body.server };
}

export async function deleteSuperadminWahaServer(
  id: string,
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const res = await fetch(`/api/superadmin/waha/servers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? `http_${res.status}`, message: body.message };
  }
  return { ok: true };
}

export async function healthCheckSuperadminWahaServer(id: string): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
  server?: WahaServerPublic;
}> {
  const res = await fetch(
    `/api/superadmin/waha/servers/${encodeURIComponent(id)}/health`,
    { method: "POST" },
  );
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    latencyMs?: number;
    error?: string;
    server?: WahaServerPublic;
  };
  return {
    ok: Boolean(body.ok),
    latencyMs: body.latencyMs,
    error: body.error,
    server: body.server,
  };
}
