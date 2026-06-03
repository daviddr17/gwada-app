import "server-only";

import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildGoogleAuthOAuthUrl,
  encodeGoogleAuthOAuthState,
  getGoogleOAuthPlatformConfigAdmin,
  GOOGLE_AUTH_NONCE_COOKIE,
  googleAuthOAuthCallbackUrl,
} from "@/lib/integrations/google-platform-oauth";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { isPlatformOAuthLoginProviderReady } from "@/lib/supabase/platform-oauth-flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function newNonce(): string {
  return crypto.randomUUID();
}

function authErrorRedirect(
  req: Request,
  message: string,
  target: "login" | "profile",
  next?: string | null,
): NextResponse {
  const origin = new URL(req.url).origin;
  if (target === "profile") {
    const url = new URL("/profile/anmeldung", origin);
    url.searchParams.set("oauth_error", message);
    return NextResponse.redirect(url);
  }
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  if (next) url.searchParams.set("next", safeInternalPath(next));
  return NextResponse.redirect(url);
}

/** Startet Google-OAuth (Login, Registrierung oder Profil-Verknüpfung). */
export async function handleGoogleOAuthConnect(
  req: NextRequest,
): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const link = searchParams.get("link") === "1";
  const next = safeInternalPath(searchParams.get("next"));

  if (!(await isPlatformOAuthLoginProviderReady("google"))) {
    return authErrorRedirect(
      req,
      link
        ? "Google-Anmeldung ist deaktiviert oder nicht konfiguriert."
        : "Google-Anmeldung ist derzeit nicht verfügbar.",
      link ? "profile" : "login",
      next,
    );
  }

  const platformCfg = await getGoogleOAuthPlatformConfigAdmin();
  if (!platformCfg) {
    return authErrorRedirect(
      req,
      link
        ? "Google-Anmeldung ist nicht konfiguriert. Bitte den Gwada-Administrator kontaktieren."
        : "Google-Anmeldung ist derzeit nicht verfügbar.",
      link ? "profile" : "login",
      next,
    );
  }

  if (link) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return authErrorRedirect(
        req,
        "Bitte melde dich zuerst an, um Google zu verknüpfen.",
        "login",
        "/profile/anmeldung",
      );
    }
  }

  const nonce = newNonce();
  const state = encodeGoogleAuthOAuthState({
    nonce,
    next: link ? "/profile/anmeldung" : next,
    link,
  });

  const redirectUri = googleAuthOAuthCallbackUrl(req);
  const url = buildGoogleAuthOAuthUrl({
    clientId: platformCfg.clientId,
    redirectUri,
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_AUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
