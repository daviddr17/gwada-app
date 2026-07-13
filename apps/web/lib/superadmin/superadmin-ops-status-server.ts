import "server-only";

import nodemailer from "nodemailer";
import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import {
  buildSuperadminCoolifyInfo,
  buildSuperadminDatabaseDetails,
  buildSuperadminVpsInfo,
} from "@/lib/superadmin/dev-infrastructure-server";
import {
  buildSuperadminRepositoryGuide,
  fetchSuperadminGithubRepoStatus,
} from "@/lib/superadmin/github-repo-status-server";
import {
  smtpCredentialsFromConfig,
  type SmtpIntegrationConfig,
} from "@/lib/integrations/smtp-integration-config";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { testFiskalyAuth } from "@/lib/pos/fiskaly-auth";
import { fetchPlatformFiskalyConfigAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { fetchTripadvisorApi } from "@/lib/integrations/tripadvisor-api-client";
import { tripadvisorErrorMessageForUser } from "@/lib/integrations/tripadvisor-user-error-messages";
import { fetchPlatformTripadvisorConfigAdmin } from "@/lib/supabase/platform-tripadvisor-secrets-db";
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
import { fetchLiveAppDeployStatus } from "@/lib/superadmin/live-app-deploy-status-server";
import { DEFAULT_WEATHER_LOCATION } from "@/lib/weather/visual-crossing-location";
import { getVisualCrossingApiKeyAdmin } from "@/lib/weather/visual-crossing-api-key";
import { checkGotrueGoogleOAuthHealth } from "@/lib/superadmin/gotrue-google-oauth-health";

const CHECK_TIMEOUT_MS = 8_000;
const DB_PROBE_TIMEOUT_MS = 12_000;

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

async function checkTripadvisorConnection(): Promise<SuperadminIntegrationConnectionHealth> {
  const platform = await fetchPlatformTripadvisorConfigAdmin();
  if (!platform.enabled) {
    return health("disabled", "Integration ist deaktiviert.");
  }
  if (!platform.apiKey) {
    return health("not_configured", "API-Key fehlt in Superadmin → Integrationen.");
  }

  try {
    const { latencyMs } = await timed(async () => {
      const result = await fetchTripadvisorApi({ path: "/allowlist" });
      if ("error" in result) {
        if (result.status === 429) {
          throw new Error(tripadvisorErrorMessageForUser(result.error, result.status));
        }
        if (result.status === 401 || result.status === 403) {
          throw new Error(tripadvisorErrorMessageForUser(result.error, result.status));
        }
      }
    });
    return health("ok", "Terra API antwortet.", latencyMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
    return health("error", msg);
  }
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

async function checkFiskalyConnection(): Promise<SuperadminIntegrationConnectionHealth> {
  const platform = await fetchPlatformFiskalyConfigAdmin();
  if (!platform.enabled) {
    return health("disabled", "Integration ist deaktiviert.");
  }
  if (!platform.apiKey || !platform.apiSecret) {
    return health(
      "not_configured",
      "API-Key und Secret fehlen in Superadmin → Integrationen.",
    );
  }

  const result = await testFiskalyAuth({
    signDeBaseUrl: platform.signDeBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    fetchFn: (input, init) => fetchWithTimeout(String(input), init),
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });

  if (!result.ok) {
    return health("error", result.message);
  }

  return health(
    "ok",
    `SIGN DE (${platform.env}) erreichbar.`,
    result.latencyMs,
  );
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

  if (key === "google_oauth") {
    const gotrue = await checkGotrueGoogleOAuthHealth();
    if (gotrue.state !== "ok") return gotrue;
    return checkGoogleReachability("Google OAuth");
  }

  if (key === "google_business") {
    return checkGoogleReachability("Google Business");
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
  const database = buildSuperadminDatabaseDetails();
  const vps = buildSuperadminVpsInfo();
  const coolify = buildSuperadminCoolifyInfo();
  const github = await fetchSuperadminGithubRepoStatus();
  const liveApp = await fetchLiveAppDeployStatus(github);
  const repository = buildSuperadminRepositoryGuide(github.defaultBranch);
  const basePayload = {
    database,
    vps,
    coolify,
    github,
    liveApp,
    repository,
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
    database: {
      ...basePayload.database,
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
  tripadvisor: checkTripadvisorConnection,
  fiskaly: checkFiskalyConnection,
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
