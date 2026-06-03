import "server-only";

import { getSupabaseAnonKey } from "@/lib/public-env";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";

const CHECK_TIMEOUT_MS = 8_000;

function health(
  state: SuperadminIntegrationConnectionHealth["state"],
  message: string,
  latencyMs?: number,
): SuperadminIntegrationConnectionHealth {
  return { state, message, latencyMs };
}

type AuthSettingsExternal = Record<string, boolean | undefined>;

/** Prüft, ob GoTrue Google als externen Provider aktiviert hat (Login per signInWithIdToken). */
export async function checkGotrueGoogleOAuthHealth(): Promise<SuperadminIntegrationConnectionHealth> {
  const anonKey = getSupabaseAnonKey();
  if (!anonKey) {
    return health(
      "not_configured",
      "Anon-Key fehlt — Auth-Einstellungen nicht prüfbar.",
    );
  }

  const upstream = resolveSupabaseUpstreamUrl();
  const url = `${upstream.replace(/\/+$/, "")}/auth/v1/settings`;

  try {
    const start = performance.now();
    const res = await fetch(url, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Auth-Settings HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      external?: AuthSettingsExternal;
    };
    const googleOn = body.external?.google === true;
    if (!googleOn) {
      throw new Error("google_provider_disabled");
    }
    const latencyMs = Math.round(performance.now() - start);

    return health(
      "ok",
      "Google am Auth-Server aktiv. Client-ID/Secret müssen mit Superadmin übereinstimmen (GOTRUE_EXTERNAL_GOOGLE_*).",
      latencyMs,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth-Prüfung fehlgeschlagen";
    if (msg === "google_provider_disabled") {
      return health(
        "error",
        "Google am Auth-Server deaktiviert. GOTRUE_EXTERNAL_GOOGLE_ENABLED=true und dieselben Zugangsdaten wie im Superadmin setzen.",
      );
    }
    return health(
      "error",
      `Auth-Server nicht erreichbar oder Settings fehlgeschlagen: ${msg}`,
    );
  }
}
