import type {
  WahaServerCapacityAlert,
  WahaServerPublic,
  WahaSessionAdminAction,
  WahaSessionAdminDetail,
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

export async function fetchSuperadminWahaSessionDetail(
  restaurantId: string,
): Promise<{ detail?: WahaSessionAdminDetail; error?: string }> {
  const res = await fetch(
    `/api/superadmin/waha/sessions/${encodeURIComponent(restaurantId)}`,
    { cache: "no-store" },
  );
  const body = (await res.json().catch(() => ({}))) as WahaSessionAdminDetail & {
    error?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? `http_${res.status}` };
  }
  return { detail: body };
}

export async function runSuperadminWahaSessionAction(
  restaurantId: string,
  action: WahaSessionAdminAction,
): Promise<{
  ok?: boolean;
  message?: string;
  detail?: WahaSessionAdminDetail;
  error?: string;
}> {
  const res = await fetch(
    `/api/superadmin/waha/sessions/${encodeURIComponent(restaurantId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    detail?: WahaSessionAdminDetail;
    error?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? `http_${res.status}`, message: body.message };
  }
  return { ok: true, message: body.message, detail: body.detail };
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
  docker_container_name?: string | null;
  ssh_host?: string | null;
  ssh_user?: string | null;
  ssh_port?: number | null;
  ssh_private_key?: string | null;
  auto_recover_enabled?: boolean;
};

export async function recoverSuperadminWahaServer(
  id: string,
  options?: { forceContainerRestart?: boolean },
): Promise<{
  ok?: boolean;
  recovered?: number;
  failed?: number;
  containerRestarts?: number;
  error?: string;
}> {
  const res = await fetch(
    `/api/superadmin/waha/servers/${encodeURIComponent(id)}/recover`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forceContainerRestart: options?.forceContainerRestart === true,
      }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    recovered?: number;
    failed?: number;
    containerRestarts?: number;
    error?: string;
  };
  if (!res.ok) return { error: body.error ?? `http_${res.status}` };
  return {
    ok: true,
    recovered: body.recovered,
    failed: body.failed,
    containerRestarts: body.containerRestarts,
  };
}

export async function triggerSuperadminWahaHostReboot(id: string): Promise<{
  ok?: boolean;
  message?: string;
  error?: string;
}> {
  const res = await fetch(
    `/api/superadmin/waha/servers/${encodeURIComponent(id)}/reboot-host`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "REBOOT" }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      error: body.error ?? `http_${res.status}`,
      message: body.message,
    };
  }
  return { ok: true, message: body.message };
}

export async function restartSuperadminWahaContainer(id: string): Promise<{
  ok?: boolean;
  message?: string;
  error?: string;
}> {
  const res = await fetch(
    `/api/superadmin/waha/servers/${encodeURIComponent(id)}/restart-container`,
    { method: "POST" },
  );
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      error: body.error ?? `http_${res.status}`,
      message: body.message,
    };
  }
  return { ok: true, message: body.message };
}

export type WahaServerVersionStatus = {
  ok: boolean;
  currentVersion: string | null;
  currentVersionRaw?: string | null;
  engine: string | null;
  nodeVersion: string | null;
  latestVersion: string | null;
  latestPublishedAt: string | null;
  latestHtmlUrl: string | null;
  updateAvailable: boolean;
  canUpdate: boolean;
  error?: string;
};

export async function fetchSuperadminWahaServerVersion(
  id: string,
): Promise<WahaServerVersionStatus & { error?: string }> {
  const res = await fetch(
    `/api/superadmin/waha/servers/${encodeURIComponent(id)}/version`,
    { method: "GET", cache: "no-store" },
  );
  const body = (await res.json().catch(() => ({}))) as WahaServerVersionStatus & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      currentVersion: null,
      engine: null,
      nodeVersion: null,
      latestVersion: null,
      latestPublishedAt: null,
      latestHtmlUrl: null,
      updateAvailable: false,
      canUpdate: false,
      error: body.error ?? body.message ?? `http_${res.status}`,
    };
  }
  return {
    ok: Boolean(body.ok),
    currentVersion: body.currentVersion ?? null,
    currentVersionRaw: body.currentVersionRaw,
    engine: body.engine ?? null,
    nodeVersion: body.nodeVersion ?? null,
    latestVersion: body.latestVersion ?? null,
    latestPublishedAt: body.latestPublishedAt ?? null,
    latestHtmlUrl: body.latestHtmlUrl ?? null,
    updateAvailable: Boolean(body.updateAvailable),
    canUpdate: Boolean(body.canUpdate),
    error: body.error,
  };
}

/** Docker-Image auf neueste WAHA-Version (compose pull). */
export async function triggerSuperadminWahaImageUpdate(id: string): Promise<{
  ok?: boolean;
  message?: string;
  error?: string;
  targetVersion?: string | null;
}> {
  const res = await fetch(
    `/api/superadmin/waha/servers/${encodeURIComponent(id)}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "UPDATE" }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    error?: string;
    targetVersion?: string | null;
  };
  if (!res.ok) {
    return {
      error: body.error ?? `http_${res.status}`,
      message: body.message,
    };
  }
  return {
    ok: true,
    message: body.message,
    targetVersion: body.targetVersion,
  };
}

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
