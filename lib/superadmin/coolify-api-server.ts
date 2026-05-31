import "server-only";

import type {
  SuperadminCoolifyActiveDeployment,
  SuperadminCoolifyLiveDeployStatus,
} from "@/lib/types/superadmin-ops-status";
import { raceWithTimeout } from "@/lib/supabase/race-timeout";

const COOLIFY_API_TIMEOUT_MS = 6_000;

type CoolifyDeploymentRecord = {
  status?: string;
  commit?: string | null;
  created_at?: string | null;
  deployment_uuid?: string | null;
  deployment_url?: string | null;
  commit_message?: string | null;
  application_name?: string | null;
};

type CoolifyApplicationRecord = {
  uuid?: string;
  status?: string;
  fqdn?: string | null;
};

function coolifyApiBaseUrl(): string | null {
  const explicit =
    process.env.GWADA_COOLIFY_API_URL?.trim() ||
    process.env.COOLIFY_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return "http://coolify:8080";
}

function coolifyAppUuid(): string | null {
  return (
    process.env.GWADA_COOLIFY_APP_UUID?.trim() ||
    process.env.COOLIFY_RESOURCE_UUID?.trim() ||
    null
  );
}

function coolifyApiToken(): string | null {
  return process.env.COOLIFY_API_TOKEN?.trim() || null;
}

function deploymentMatchesApp(
  row: CoolifyDeploymentRecord,
  appUuid: string,
): boolean {
  const url = row.deployment_url ?? "";
  if (url.includes(appUuid)) return true;
  return false;
}

function normalizeDeploymentsPayload(
  body: unknown,
): CoolifyDeploymentRecord[] {
  if (Array.isArray(body)) return body as CoolifyDeploymentRecord[];
  if (body && typeof body === "object") {
    return Object.values(body as Record<string, CoolifyDeploymentRecord>);
  }
  return [];
}

function summarizeActive(
  active: SuperadminCoolifyActiveDeployment[],
): SuperadminCoolifyLiveDeployStatus["summary"] {
  if (active.some((d) => d.status === "in_progress")) return "deploying";
  if (active.some((d) => d.status === "queued")) return "queued";
  return "idle";
}

async function coolifyFetchJson(path: string): Promise<unknown> {
  const base = coolifyApiBaseUrl();
  const token = coolifyApiToken();
  if (!base || !token) {
    throw new Error("coolify_api_not_configured");
  }

  const res = await raceWithTimeout(
    fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
    COOLIFY_API_TIMEOUT_MS,
    "Coolify-API",
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`coolify_api_${res.status}`);
  }

  if (text.includes('"API is disabled"')) {
    throw new Error("coolify_api_disabled");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("coolify_api_invalid_json");
  }
}

export async function fetchCoolifyLiveDeployStatus(): Promise<SuperadminCoolifyLiveDeployStatus> {
  const applicationUuid = coolifyAppUuid();
  const apiConfigured = Boolean(coolifyApiToken() && applicationUuid);

  if (!apiConfigured) {
    return {
      apiConfigured: false,
      apiReachable: false,
      applicationUuid,
      appRuntimeStatus: null,
      active: [],
      summary: "unavailable",
      message:
        "COOLIFY_API_TOKEN und GWADA_COOLIFY_APP_UUID in der App-Env setzen.",
    };
  }

  try {
    const [deploymentsBody, appBody] = await Promise.all([
      coolifyFetchJson("/api/v1/deployments"),
      coolifyFetchJson(`/api/v1/applications/${applicationUuid}`),
    ]);

    const app = appBody as CoolifyApplicationRecord;
    const rows = normalizeDeploymentsPayload(deploymentsBody).filter((row) =>
      deploymentMatchesApp(row, applicationUuid!),
    );

    const active: SuperadminCoolifyActiveDeployment[] = rows
      .filter((row) => {
        const status = row.status?.trim() ?? "";
        return status === "in_progress" || status === "queued";
      })
      .sort((a, b) => {
        const rank = (s: string | undefined) =>
          s === "in_progress" ? 0 : s === "queued" ? 1 : 2;
        return rank(a.status) - rank(b.status);
      })
      .map((row) => ({
        status: row.status?.trim() ?? "unknown",
        commit: row.commit?.trim() || null,
        startedAt: row.created_at ?? null,
        deploymentUuid: row.deployment_uuid ?? null,
        deploymentUiPath: row.deployment_url ?? null,
      }));

    return {
      apiConfigured: true,
      apiReachable: true,
      applicationUuid,
      appRuntimeStatus: app.status?.trim() || null,
      active,
      summary: summarizeActive(active),
      message: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "coolify_api_error";
    let hint = "Coolify-API nicht erreichbar.";
    if (msg === "coolify_api_disabled") {
      hint = "Coolify-API ist deaktiviert (Einstellungen → API aktivieren).";
    } else if (msg === "coolify_api_not_configured") {
      hint = "COOLIFY_API_TOKEN fehlt.";
    }

    return {
      apiConfigured,
      apiReachable: false,
      applicationUuid,
      appRuntimeStatus: null,
      active: [],
      summary: "unavailable",
      message: hint,
    };
  }
}
