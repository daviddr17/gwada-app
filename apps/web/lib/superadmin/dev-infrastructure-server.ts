import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  getPublicGwadaWorkspaceSlug,
  getPublicSiteUrl,
  getPublicSupabaseUrl,
  isPublicGwadaSupabaseOnly,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";
import type {
  SuperadminCoolifyInfo,
  SuperadminDatabaseDetails,
  SuperadminVpsInfo,
} from "@/lib/types/superadmin-ops-status";

function parseSafeHttpOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function supabaseStudioHintFromLocalUpstream(upstream: string | null): string | null {
  if (!upstream) return null;
  try {
    const u = new URL(upstream);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      u.port = "54323";
      u.pathname = "";
      u.search = "";
      u.hash = "";
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    return null;
  }
  return null;
}

function resolveSupabaseStudioDisplay(upstream: string | null): {
  url: string | null;
  note: string | null;
} {
  const explicit = parseSafeHttpOrigin(process.env.GWADA_SUPABASE_STUDIO_URL);
  const dockerKong = Boolean(upstream?.includes("supabase-kong-"));
  const studioSecureUrl = "https://studio.new.gwada.app";
  const autheliaNote =
    "Studio über Authelia (2FA): https://auth.new.gwada.app";
  const vpsHost =
    process.env.GWADA_VPS_PUBLIC_HOST?.trim()?.replace(/^https?:\/\//, "") ??
    "95.111.229.250";
  const tunnelNote = `SSH-Tunnel: ssh -L 54323:127.0.0.1:54323 root@${vpsHost.split("/")[0]} → http://127.0.0.1:54323`;

  if (explicit) {
    return {
      url: explicit,
      note: dockerKong ? `${autheliaNote} · ${tunnelNote}` : null,
    };
  }

  if (dockerKong) {
    return {
      url: studioSecureUrl,
      note: `${autheliaNote} · ${tunnelNote}`,
    };
  }

  return {
    url: supabaseStudioHintFromLocalUpstream(upstream),
    note: upstream ? null : "Lokal: supabase start → http://127.0.0.1:54323",
  };
}

function inferDeploymentPhase(
  appUrl: string | null,
): SuperadminVpsInfo["deploymentPhase"] {
  if (!appUrl) return "development";
  try {
    const host = new URL(appUrl).hostname.toLowerCase();
    if (host === "gwada.app" || host === "www.gwada.app") return "production";
    if (host === "new.gwada.app" || host.startsWith("new.")) return "staging";
    if (host === "127.0.0.1" || host === "localhost") return "development";
    return "staging";
  } catch {
    return "staging";
  }
}

function countMigrationFiles(): number | null {
  try {
    const dir = path.join(process.cwd(), "supabase/migrations");
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .length;
  } catch {
    return null;
  }
}

function upstreamHostLabel(upstream: string | null): string | null {
  if (!upstream) return null;
  try {
    return new URL(upstream).host;
  } catch {
    return upstream;
  }
}

export function buildSuperadminDatabaseDetails(): SuperadminDatabaseDetails {
  const supabaseUpstream = parseSafeHttpOrigin(
    process.env.SUPABASE_UPSTREAM_URL,
  );
  const studio = resolveSupabaseStudioDisplay(supabaseUpstream);

  return {
    publicUrl: getPublicSupabaseUrl() ?? null,
    proxyEnabled: isPublicSupabaseProxyEnabled(),
    upstreamConfigured: Boolean(process.env.SUPABASE_UPSTREAM_URL?.trim()),
    upstreamHost: upstreamHostLabel(supabaseUpstream),
    studioUrl: studio.url,
    studioAccessNote: studio.note,
    serviceRoleConfigured: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
    supabaseOnlyMode: isPublicGwadaSupabaseOnly(),
    migrationFilesCount: countMigrationFiles(),
  };
}

function resolveCoolifyDashboardUrl(): string | null {
  const explicit = parseSafeHttpOrigin(process.env.GWADA_COOLIFY_DASHBOARD_URL);
  if (explicit) return explicit;
  const host = process.env.GWADA_VPS_PUBLIC_HOST?.trim()?.replace(
    /^https?:\/\//,
    "",
  );
  if (host) {
    return `http://${host.split("/")[0]}:8000`;
  }
  return null;
}

export function buildSuperadminCoolifyInfo(): SuperadminCoolifyInfo {
  const upstream = process.env.SUPABASE_UPSTREAM_URL?.trim() ?? "";
  const supabaseDockerStack = upstream.includes("supabase-kong-");
  const runtime =
    process.env.NODE_ENV === "production" ? "production" : "development";
  const proxyEnabled = isPublicSupabaseProxyEnabled();
  const hostingDetected = Boolean(
    process.env.COOLIFY_FQDN?.trim() ||
      process.env.COOLIFY_RESOURCE_UUID?.trim() ||
      process.env.GWADA_COOLIFY_APP_UUID?.trim() ||
      supabaseDockerStack ||
      (runtime === "production" && proxyEnabled && upstream),
  );

  return {
    hostingDetected,
    supabaseDockerStack,
    dashboardUrl: resolveCoolifyDashboardUrl(),
  };
}

export function buildSuperadminVpsInfo(): SuperadminVpsInfo {
  const runtime =
    process.env.NODE_ENV === "production" ? "production" : "development";
  const siteUrl = getPublicSiteUrl() ?? null;
  const plannedProductionUrl =
    parseSafeHttpOrigin(process.env.GWADA_PLANNED_PRODUCTION_URL) ??
    "https://gwada.app";
  const publicHost =
    process.env.GWADA_VPS_PUBLIC_HOST?.trim()?.replace(/^https?:\/\//, "") ??
    "95.111.229.250";

  return {
    provider: "Contabo",
    publicHost: publicHost.split("/")[0] || null,
    sshUser: "root",
    siteUrl,
    plannedProductionUrl,
    deploymentPhase:
      runtime === "development" ? "development" : inferDeploymentPhase(siteUrl),
    runtime,
    workspaceSlug: getPublicGwadaWorkspaceSlug() ?? null,
  };
}
