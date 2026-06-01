import "server-only";

import nodemailer from "nodemailer";
import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import {
  getPublicGwadaWorkspaceSlug,
  getPublicSiteUrl,
  getPublicSupabaseUrl,
  isPublicGwadaSupabaseOnly,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";
import {
  smtpCredentialsFromConfig,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { fetchPlatformWeatherConfigAdmin } from "@/lib/supabase/platform-weather-secrets-db";
import { fetchPlatformWhatsappWahaConfigAdmin } from "@/lib/supabase/platform-whatsapp-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { raceWithTimeout } from "@/lib/supabase/race-timeout";
import type {
  SuperadminDatabaseStatus,
  SuperadminIntegrationConnectionHealth,
  SuperadminIntegrationConnectionState,
} from "@/lib/types/superadmin-ops-status";
import {
  integrationConfigFromJson,
  type PlatformIntegrationKey,
} from "@/lib/types/platform-integration";
import { fetchCoolifyLiveDeployStatus } from "@/lib/superadmin/coolify-api-server";
import { fetchLiveAppDeployStatus } from "@/lib/superadmin/live-app-deploy-status-server";
import { DEFAULT_WEATHER_LOCATION } from "@/lib/weather/visual-crossing-location";
import { getVisualCrossingApiKeyAdmin } from "@/lib/weather/visual-crossing-api-key";

const CHECK_TIMEOUT_MS = 8_000;
const DB_PROBE_TIMEOUT_MS = 12_000;

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
    "Studio über Authelia (2FA): https://auth.new.gwada.app — Port 54323 bleibt localhost-only.";
  const tunnelNote =
    "Alternativ SSH-Tunnel: ssh -L 54323:127.0.0.1:54323 root@VPS → http://127.0.0.1:54323";

  if (explicit) {
    return {
      url: explicit,
      note: dockerKong ? autheliaNote : null,
    };
  }

  if (dockerKong) {
    const host = process.env.GWADA_VPS_PUBLIC_HOST?.trim()?.replace(
      /^https?:\/\//,
      "",
    );
    if (host) {
      const vps = host.split("/")[0];
      return {
        url: studioSecureUrl,
        note: `${autheliaNote} ${tunnelNote.replace("VPS", vps)}`,
      };
    }
    return {
      url: studioSecureUrl,
      note: autheliaNote,
    };
  }

  return {
    url: supabaseStudioHintFromLocalUpstream(upstream),
    note: null,
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

function inferDeploymentPhase(
  appUrl: string | null,
): SuperadminDatabaseStatus["coolify"]["deploymentPhase"] {
  if (!appUrl) return "development";
  try {
    const host = new URL(appUrl).hostname.toLowerCase();
    if (host === "new.gwada.app" || host.startsWith("new.")) return "staging";
    if (host === "gwada.app" || host === "www.gwada.app") return "production";
    if (host === "127.0.0.1" || host === "localhost") return "development";
    return "staging";
  } catch {
    return "staging";
  }
}

function buildCoolifyDeploymentInfo(
  liveDeploy: SuperadminDatabaseStatus["coolify"]["liveDeploy"],
): SuperadminDatabaseStatus["coolify"] {
  const runtime =
    process.env.NODE_ENV === "production" ? "production" : "development";
  const appUrl = getPublicSiteUrl() ?? null;
  const plannedProductionUrl =
    parseSafeHttpOrigin(process.env.GWADA_PLANNED_PRODUCTION_URL) ??
    "https://gwada.app";
  const supabasePublicUrl = getPublicSupabaseUrl() ?? null;
  const supabaseUpstream = parseSafeHttpOrigin(
    process.env.SUPABASE_UPSTREAM_URL,
  );
  const studio = resolveSupabaseStudioDisplay(supabaseUpstream);
  const proxyEnabled = isPublicSupabaseProxyEnabled();
  const dashboardUrl = resolveCoolifyDashboardUrl();
  const deployBranch = process.env.COOLIFY_BRANCH?.trim() || null;
  const sourceCommit =
    process.env.SOURCE_COMMIT?.trim() ||
    process.env.COOLIFY_COMMIT?.trim() ||
    null;
  const detected = Boolean(
    deployBranch ||
      sourceCommit ||
      process.env.COOLIFY_FQDN?.trim() ||
      process.env.COOLIFY_RESOURCE_UUID?.trim() ||
      (runtime === "production" && proxyEnabled && supabaseUpstream),
  );

  const applicationUuid =
    process.env.GWADA_COOLIFY_APP_UUID?.trim() ||
    process.env.COOLIFY_RESOURCE_UUID?.trim() ||
    null;

  return {
    detected,
    runtime,
    deploymentPhase:
      runtime === "development" ? "development" : inferDeploymentPhase(appUrl),
    appUrl,
    plannedProductionUrl,
    supabasePublicUrl,
    supabaseUpstream,
    supabaseStudioHint: studio.url,
    supabaseStudioAccessNote: studio.note,
    dashboardUrl,
    deployBranch,
    sourceCommit,
    proxyEnabled,
    applicationUuid,
    liveDeploy,
  };
}

function health(
  state: SuperadminIntegrationConnectionState,
  message?: string,
  latencyMs?: number,
): SuperadminIntegrationConnectionHealth {
  return { state, message, latencyMs };
}

async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ data: T; latencyMs: number }> {
  const start = performance.now();
  const data = await fn();
  return { data, latencyMs: Math.round(performance.now() - start) };
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
}

async function checkWeatherConnection(): Promise<SuperadminIntegrationConnectionHealth> {
  const platform = await fetchPlatformWeatherConfigAdmin();
  if (!platform.enabled) {
    return health("disabled", "Integration ist deaktiviert.");
  }
  const key = await getVisualCrossingApiKeyAdmin();
  if (!key) {
    return health("not_configured", "API-Key fehlt in Superadmin → Integrationen.");
  }

  try {
    const { latencyMs } = await timed(async () => {
      const pathLoc = encodeURIComponent(DEFAULT_WEATHER_LOCATION);
      const url = new URL(
        `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${pathLoc}/today`,
      );
      url.searchParams.set("include", "current");
      url.searchParams.set("unitGroup", "metric");
      url.searchParams.set("key", key);
      const res = await fetchWithTimeout(url.toString());
      if (!res.ok) {
        throw new Error(`Visual Crossing HTTP ${res.status}`);
      }
    });
    return health("ok", "Visual Crossing antwortet.", latencyMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
    return health("error", msg);
  }
}

async function checkWhatsappConnection(): Promise<SuperadminIntegrationConnectionHealth> {
  const platform = await fetchPlatformWhatsappWahaConfigAdmin();
  if (!platform.enabled) {
    return health("disabled", "Integration ist deaktiviert.");
  }
  if (!platform.waha) {
    return health(
      "not_configured",
      "WAHA API-Link oder API-Key fehlt in Superadmin → Integrationen.",
    );
  }

  const waha = platform.waha;

  try {
    const { latencyMs } = await timed(async () => {
      const url = `${waha.baseUrl}/api/sessions`;
      const res = await fetchWithTimeout(url, {
        headers: {
          "X-Api-Key": waha.apiKey,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        throw new Error(`WAHA HTTP ${res.status}`);
      }
    });
    return health("ok", "WAHA-Server erreichbar.", latencyMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
    return health("error", msg);
  }
}

async function verifySmtp(
  config: SmtpIntegrationConfig,
): Promise<SuperadminIntegrationConnectionHealth> {
  const creds = smtpCredentialsFromConfig(config);
  if (!creds) {
    return health("not_configured", "SMTP-/IMAP-Zugangsdaten unvollständig.");
  }

  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpPort === 465,
    auth: { user: creds.email, pass: creds.password },
  });

  try {
    const { latencyMs } = await timed(async () => {
      await transporter.verify();
    });
    return health("ok", "SMTP-Verbindung erfolgreich.", latencyMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMTP-Verbindung fehlgeschlagen";
    return health("error", msg);
  } finally {
    transporter.close();
  }
}

async function checkEmailConnection(): Promise<SuperadminIntegrationConnectionHealth> {
  const row = await fetchPlatformEmailSmtpConfigAdmin();
  if (!row?.enabled) {
    return health("disabled", "Integration ist deaktiviert.");
  }
  if (!createSupabaseAdminClient()) {
    return health(
      "error",
      "Service-Role fehlt — SMTP-Passwort kann serverseitig nicht gelesen werden.",
    );
  }
  return verifySmtp(row.config);
}

async function verifyMetaCredentials(
  appId: string,
  appSecret: string,
): Promise<SuperadminIntegrationConnectionHealth> {
  try {
    const { latencyMs } = await timed(async () => {
      const url = new URL(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      );
      url.searchParams.set("client_id", appId);
      url.searchParams.set("client_secret", appSecret);
      url.searchParams.set("grant_type", "client_credentials");
      const res = await fetchWithTimeout(url.toString());
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? `Meta HTTP ${res.status}`);
      }
    });
    return health("ok", "Meta-App-Zugangsdaten gültig.", latencyMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Meta-Verbindung fehlgeschlagen";
    return health("error", msg);
  }
}

async function checkGoogleReachability(
  label: string,
): Promise<SuperadminIntegrationConnectionHealth> {
  try {
    const { latencyMs } = await timed(async () => {
      const res = await fetchWithTimeout(
        "https://accounts.google.com/.well-known/openid-configuration",
      );
      if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
    });
    return health(
      "ok",
      `${label}: Google-OAuth erreichbar, Zugangsdaten hinterlegt.`,
      latencyMs,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google nicht erreichbar";
    return health("error", msg);
  }
}

async function checkOAuthIntegration(
  key: PlatformIntegrationKey,
): Promise<SuperadminIntegrationConnectionHealth> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return health("error", "Service-Role nicht konfiguriert.");
  }

  const { data } = await admin
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", key)
    .maybeSingle();

  if (!data?.enabled) {
    return health("disabled", "Integration ist deaktiviert.");
  }

  const cfg = integrationConfigFromJson(data.config);
  const clientId = cfg.client_id?.trim() ?? "";
  const hasSecret = Boolean(cfg.client_secret?.trim());

  if (!clientId || !hasSecret) {
    return health("not_configured", "Client ID oder Secret fehlt.");
  }

  if (key === "facebook" || key === "instagram") {
    return verifyMetaCredentials(clientId, cfg.client_secret!.trim());
  }

  if (key === "google_oauth" || key === "google_business") {
    return checkGoogleReachability(
      key === "google_oauth" ? "Google OAuth" : "Google Business",
    );
  }

  if (key === "apple_oauth") {
    return health(
      "ok",
      "Apple-Zugangsdaten hinterlegt (Live-Prüfung nur beim Sign-In).",
    );
  }

  return health("ok", "Zugangsdaten hinterlegt.");
}

async function countExact(
  table: "restaurants" | "profiles" | "platform_superadmins",
): Promise<number | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

export async function buildSuperadminDatabaseStatus(): Promise<SuperadminDatabaseStatus> {
  const totalStart = performance.now();
  const checkedAt = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const publicUrl = getPublicSupabaseUrl() ?? null;
  const liveDeploy = await fetchCoolifyLiveDeployStatus();
  const coolify = buildCoolifyDeploymentInfo(liveDeploy);
  const liveApp = await fetchLiveAppDeployStatus(liveDeploy.summary);
  const basePayload = {
    api: {
      publicUrl,
      proxyEnabled: isPublicSupabaseProxyEnabled(),
      siteUrl: getPublicSiteUrl() ?? null,
      workspaceSlug: getPublicGwadaWorkspaceSlug() ?? null,
    },
    server: {
      serviceRoleConfigured: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      ),
      supabaseUpstreamConfigured: Boolean(
        process.env.SUPABASE_UPSTREAM_URL?.trim(),
      ),
      supabaseOnlyMode: isPublicGwadaSupabaseOnly(),
    },
    coolify,
    liveApp,
  };

  if (!admin) {
    return {
      ok: false,
      checkedAt,
      latencyMs: null,
      countsLatencyMs: null,
      totalCheckLatencyMs: Math.round(performance.now() - totalStart),
      message:
        "Service-Role oder NEXT_PUBLIC_SUPABASE_URL fehlt — keine DB-Abfrage möglich.",
      ...basePayload,
      counts: {
        restaurants: null,
        profiles: null,
        platformSuperadmins: null,
      },
    };
  }

  let latencyMs: number | null = null;
  let ok = false;
  let message: string | undefined;

  try {
    const start = performance.now();
    const { error } = await raceWithTimeout(
      admin.from("restaurants").select("id").limit(1),
      DB_PROBE_TIMEOUT_MS,
      "Supabase-DB",
    );
    latencyMs = Math.round(performance.now() - start);
    if (error) {
      message = error.message;
    } else {
      ok = true;
    }
  } catch (e) {
    message = e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
  }

  const countsStart = performance.now();
  const [restaurants, profiles, platformSuperadmins] = await Promise.all([
    countExact("restaurants"),
    countExact("profiles"),
    countExact("platform_superadmins"),
  ]);
  const countsLatencyMs = Math.round(performance.now() - countsStart);

  return {
    ok,
    checkedAt,
    latencyMs,
    countsLatencyMs,
    totalCheckLatencyMs: Math.round(performance.now() - totalStart),
    message,
    ...basePayload,
    server: {
      ...basePayload.server,
      serviceRoleConfigured: true,
    },
    counts: {
      restaurants,
      profiles,
      platformSuperadmins,
    },
  };
}

const HEALTH_CHECKERS: Partial<
  Record<
    PlatformIntegrationKey,
    () => Promise<SuperadminIntegrationConnectionHealth>
  >
> = {
  weather: checkWeatherConnection,
  whatsapp: checkWhatsappConnection,
  email: checkEmailConnection,
  google_oauth: () => checkOAuthIntegration("google_oauth"),
  apple_oauth: () => checkOAuthIntegration("apple_oauth"),
  facebook: () => checkOAuthIntegration("facebook"),
  instagram: () => checkOAuthIntegration("instagram"),
  google_business: () => checkOAuthIntegration("google_business"),
};

export async function buildSuperadminIntegrationHealthMap(): Promise<{
  checkedAt: string;
  integrations: Record<
    PlatformIntegrationKey,
    SuperadminIntegrationConnectionHealth
  >;
}> {
  const keys = Object.keys(HEALTH_CHECKERS) as PlatformIntegrationKey[];
  const entries = await Promise.all(
    keys.map(async (key) => {
      const checker = HEALTH_CHECKERS[key]!;
      try {
        const result = await checker();
        return [key, result] as const;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Prüfung fehlgeschlagen";
        return [key, health("error", msg)] as const;
      }
    }),
  );

  return {
    checkedAt: new Date().toISOString(),
    integrations: Object.fromEntries(entries) as Record<
      PlatformIntegrationKey,
      SuperadminIntegrationConnectionHealth
    >,
  };
}
