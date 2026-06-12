import type { SuperadminDatabaseStatus } from "@/lib/types/superadmin-ops-status";
import type { PlatformIntegrationKey } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";

export async function fetchSuperadminDatabaseStatus(): Promise<{
  status: SuperadminDatabaseStatus | null;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/database-status", { cache: "no-store" });
  const data = (await res.json()) as SuperadminDatabaseStatus & { error?: string };
  if (!res.ok) {
    return { status: null, error: data.error ?? "Laden fehlgeschlagen." };
  }
  return { status: data, error: null };
}

export async function triggerSuperadminLiveAppDeploy(): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/app-deploy/trigger", {
    method: "POST",
    cache: "no-store",
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Deploy konnte nicht gestartet werden." };
  }
  return { ok: true, error: null };
}

export async function triggerSuperadminLiveDbDeploy(): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/db-deploy/trigger", {
    method: "POST",
    cache: "no-store",
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? "DB-Deploy konnte nicht gestartet werden.",
    };
  }
  return { ok: true, error: null };
}

export async function fetchSuperadminIntegrationHealth(): Promise<{
  checkedAt: string;
  integrations: Partial<
    Record<PlatformIntegrationKey, SuperadminIntegrationConnectionHealth>
  >;
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/platform-integrations/health", {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    checkedAt?: string;
    integrations?: Partial<
      Record<PlatformIntegrationKey, SuperadminIntegrationConnectionHealth>
    >;
    error?: string;
  };
  if (!res.ok) {
    return {
      checkedAt: "",
      integrations: {},
      error: data.error ?? "Verbindungsprüfung fehlgeschlagen.",
    };
  }
  return {
    checkedAt: data.checkedAt ?? "",
    integrations: data.integrations ?? {},
    error: null,
  };
}
