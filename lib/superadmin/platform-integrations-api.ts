import type {
  PlatformIntegrationKey,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";

export async function fetchSuperadminPlatformIntegrations(): Promise<{
  rows: PlatformIntegrationRow[];
  error: string | null;
}> {
  const res = await fetch("/api/superadmin/platform-integrations", {
    cache: "no-store",
  });
  const data = (await res.json()) as {
    rows?: PlatformIntegrationRow[];
    error?: string;
  };
  if (!res.ok) {
    return { rows: [], error: data.error ?? "Laden fehlgeschlagen." };
  }
  return { rows: data.rows ?? [], error: null };
}

export async function saveSuperadminPlatformIntegration(
  key: PlatformIntegrationKey,
  enabled: boolean,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  const res = await fetch("/api/superadmin/platform-integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, enabled, config }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Speichern fehlgeschlagen." };
  }
  return { ok: true, error: null };
}
