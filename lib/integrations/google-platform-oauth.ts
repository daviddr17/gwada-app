import "server-only";

import { readPlatformIntegrationEnabled } from "@/lib/supabase/platform-integration-enabled";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSiteUrl } from "@/lib/public-env";

export const GOOGLE_AUTH_OAUTH_SCOPES = ["openid", "email", "profile"] as const;

export { GOOGLE_AUTH_NONCE_COOKIE } from "@/lib/cookies/bloated-request-cookies";

export type GoogleOAuthPlatformConfig = {
  clientId: string;
  clientSecret: string;
};

export type GoogleAuthOAuthState = {
  next?: string;
  link?: boolean;
  nonce: string;
};

export async function getGoogleOAuthPlatformConfigAdmin(): Promise<GoogleOAuthPlatformConfig | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "google_oauth")
    .maybeSingle();

  if (!data || !readPlatformIntegrationEnabled(data.enabled)) return null;

  const cfg = data.config as Record<string, unknown>;
  const clientId =
    typeof cfg.client_id === "string" ? cfg.client_id.trim() : "";
  const clientSecret =
    typeof cfg.client_secret === "string" ? cfg.client_secret.trim() : "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleAuthOAuthCallbackUrl(req: Request): string {
  const site = getPublicSiteUrl();
  if (site) return `${site}/api/auth/google/callback`;
  return `${new URL(req.url).origin}/api/auth/google/callback`;
}

export function encodeGoogleAuthOAuthState(payload: GoogleAuthOAuthState): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeGoogleAuthOAuthState(
  state: string,
): GoogleAuthOAuthState | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as GoogleAuthOAuthState;
    if (!parsed.nonce || typeof parsed.nonce !== "string") return null;
    return {
      nonce: parsed.nonce,
      next: typeof parsed.next === "string" ? parsed.next : undefined,
      link: parsed.link === true,
    };
  } catch {
    return null;
  }
}

export function buildGoogleAuthOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: GOOGLE_AUTH_OAUTH_SCOPES.join(" "),
    state: params.state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeGoogleAuthCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<
  | {
      accessToken: string;
      idToken: string;
      refreshToken: string | null;
    }
  | { error: string }
> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const body = (await res.json()) as {
    access_token?: string;
    id_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token || !body.id_token) {
    return {
      error: body.error_description ?? body.error ?? `google_token_${res.status}`,
    };
  }
  return {
    accessToken: body.access_token,
    idToken: body.id_token,
    refreshToken: body.refresh_token ?? null,
  };
}

/** Nutzerfreundliche Meldung bei GoTrue-Fehlern nach signInWithIdToken / linkIdentity. */
export function humanizeGoogleAuthSessionError(raw: string): string {
  const t = raw.trim();
  if (/provider.*not enabled|unsupported provider/i.test(t)) {
    return "Google-Anmeldung ist auf dem Auth-Server noch nicht aktiv. Client-ID und Secret müssen dort dieselben Werte haben wie unter Superadmin → Integrationen (SUPABASE_AUTH_EXTERNAL_GOOGLE_*).";
  }
  if (/audience|client_id|client id/i.test(t)) {
    return "Die Google Client-ID stimmt nicht mit der Auth-Server-Konfiguration überein. Trage dieselbe Client-ID wie im Superadmin auch in SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ein.";
  }
  if (/manual linking|linking.*disabled/i.test(t)) {
    return "Identitäts-Verknüpfung ist am Auth-Server deaktiviert (enable_manual_linking).";
  }
  if (/already.*linked|identity.*exists/i.test(t)) {
    return "Dieses Google-Konto ist bereits mit einem anderen Gwada-Profil verknüpft.";
  }
  return t || "Google-Anmeldung fehlgeschlagen.";
}
