import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  decodeGoogleAuthOAuthState,
  exchangeGoogleAuthCode,
  getGoogleOAuthPlatformConfigAdmin,
  GOOGLE_AUTH_NONCE_COOKIE,
  googleAuthOAuthCallbackUrl,
  humanizeGoogleAuthSessionError,
} from "@/lib/integrations/google-platform-oauth";
import { resolveRequestOriginFromRequest } from "@/lib/navigation/request-origin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

function redirectLogin(
  origin: string,
  message: string,
  next?: string | null,
): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  if (next) url.searchParams.set("next", safeInternalPath(next));
  return NextResponse.redirect(url);
}

function redirectProfile(origin: string, params: {
  oauth_error?: string;
  oauth_linked?: boolean;
}): NextResponse {
  const url = new URL("/profile/anmeldung", origin);
  if (params.oauth_linked) url.searchParams.set("oauth_linked", "google");
  if (params.oauth_error) url.searchParams.set("oauth_error", params.oauth_error);
  return NextResponse.redirect(url);
}

export async function handleGoogleOAuthCallback(
  request: NextRequest,
): Promise<NextResponse> {
  const origin = resolveRequestOriginFromRequest(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return redirectLogin(
      origin,
      String(oauthError).slice(0, 200),
      searchParams.get("next"),
    );
  }

  if (!code || !stateRaw) {
    return redirectLogin(origin, "Google-Anmeldung abgebrochen oder unvollständig.");
  }

  const state = decodeGoogleAuthOAuthState(stateRaw);
  if (!state) {
    return redirectLogin(origin, "Ungültige Anmelde-Sitzung. Bitte erneut versuchen.");
  }

  const cookieStore = await cookies();
  const nonceCookie = cookieStore.get(GOOGLE_AUTH_NONCE_COOKIE)?.value;
  if (!nonceCookie || nonceCookie !== state.nonce) {
    return redirectLogin(
      origin,
      "Anmelde-Sitzung abgelaufen. Bitte erneut mit Google starten.",
      state.next,
    );
  }

  const platformCfg = await getGoogleOAuthPlatformConfigAdmin();
  if (!platformCfg) {
    return state.link
      ? redirectProfile(origin, {
          oauth_error: "Google-Anmeldung ist nicht konfiguriert.",
        })
      : redirectLogin(origin, "Google-Anmeldung ist derzeit nicht verfügbar.", state.next);
  }

  const redirectUri = googleAuthOAuthCallbackUrl(request);
  const tokenResult = await exchangeGoogleAuthCode({
    clientId: platformCfg.clientId,
    clientSecret: platformCfg.clientSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    const msg = tokenResult.error.slice(0, 200);
    return state.link
      ? redirectProfile(origin, { oauth_error: msg })
      : redirectLogin(origin, msg, state.next);
  }

  const anonKey = getSupabaseAnonKey();
  if (!anonKey) {
    return redirectLogin(origin, "Supabase ist nicht konfiguriert.", state.next);
  }

  const supabase = createServerClient(resolveSupabaseUrl(origin), anonKey, {
    cookieOptions: gwadaSupabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const clearNonce = (res: NextResponse) => {
    res.cookies.set(GOOGLE_AUTH_NONCE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  };

  if (state.link) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      token: tokenResult.idToken,
      access_token: tokenResult.accessToken,
    });
    if (error) {
      return clearNonce(
        redirectProfile(origin, {
          oauth_error: humanizeGoogleAuthSessionError(error.message),
        }),
      );
    }
    return clearNonce(
      redirectProfile(origin, { oauth_linked: true }),
    );
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokenResult.idToken,
    access_token: tokenResult.accessToken,
  });

  if (error) {
    return clearNonce(
      redirectLogin(
        origin,
        humanizeGoogleAuthSessionError(error.message),
        state.next,
      ),
    );
  }

  const next = safeInternalPath(state.next);
  return clearNonce(
    NextResponse.redirect(
      new URL(`/auth/enter?next=${encodeURIComponent(next)}`, origin),
    ),
  );
}
