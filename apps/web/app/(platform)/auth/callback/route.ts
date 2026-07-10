import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { resolveRequestOriginFromRequest } from "@/lib/navigation/request-origin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";
import { appendAuthEntryCookieCleanup } from "@/lib/cookies/bloated-request-cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  GWADA_PUBLIC_SIGNUP_ENABLED,
  GWADA_WAITLIST_SIGNUP_MESSAGE,
} from "@/lib/auth/public-signup-gate";
import {
  isInviteSignupNextPath,
  isSignupAllowedForEmailAdmin,
} from "@/lib/auth/staff-invite-signup-gate";
import { humanizeLoginErrorMessage } from "@/lib/auth/login-error-messages";

function loginRedirect(
  origin: string,
  message: string,
  next?: string | null,
): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  if (next) url.searchParams.set("next", safeInternalPath(next));
  const headers = new Headers({ Location: url.toString() });
  appendAuthEntryCookieCleanup(headers);
  return new NextResponse(null, { status: 302, headers });
}

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  const t = raw?.trim();
  if (
    t === "signup" ||
    t === "invite" ||
    t === "magiclink" ||
    t === "recovery" ||
    t === "email_change" ||
    t === "email"
  ) {
    return t;
  }
  return null;
}

async function finishAuthRedirect(
  origin: string,
  next: string,
  sessionData: {
    session: { user: { created_at?: string; email?: string | null } } | null;
  } | null,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  rawNextParam: string | null,
): Promise<NextResponse> {
  if (
    !GWADA_PUBLIC_SIGNUP_ENABLED &&
    sessionData?.session?.user?.created_at
  ) {
    const createdMs = new Date(sessionData.session.user.created_at).getTime();
    if (Date.now() - createdMs < 120_000) {
      const admin = createSupabaseAdminClient();
      const userEmail = sessionData.session.user.email;
      const allowed =
        isInviteSignupNextPath(rawNextParam) ||
        (admin && userEmail
          ? await isSignupAllowedForEmailAdmin(admin, userEmail)
          : false);
      if (!allowed) {
        await supabase.auth.signOut();
        return loginRedirect(origin, GWADA_WAITLIST_SIGNUP_MESSAGE, rawNextParam);
      }
    }
  }

  const enterUrl = new URL(
    `/auth/enter?next=${encodeURIComponent(next)}`,
    origin,
  );
  const headers = new Headers({ Location: enterUrl.toString() });
  appendAuthEntryCookieCleanup(headers);
  return new NextResponse(null, { status: 302, headers });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = resolveRequestOriginFromRequest(request);
  const next = safeInternalPath(searchParams.get("next"));
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return loginRedirect(
      origin,
      humanizeLoginErrorMessage(String(oauthError).slice(0, 200)),
      searchParams.get("next"),
    );
  }

  const anonKey = getSupabaseAnonKey();
  if (!anonKey) {
    return loginRedirect(origin, "Supabase ist nicht konfiguriert.");
  }

  const cookieStore = await cookies();
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

  const tokenHash = searchParams.get("token_hash")?.trim();
  const otpType = parseEmailOtpType(searchParams.get("type"));

  if (tokenHash && otpType) {
    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (error) {
      return loginRedirect(
        origin,
        humanizeLoginErrorMessage(error.message),
        searchParams.get("next"),
      );
    }
    return finishAuthRedirect(
      origin,
      next,
      sessionData,
      supabase,
      searchParams.get("next"),
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return loginRedirect(origin, "Anmeldung abgebrochen oder unvollständig.");
  }

  const { data: sessionData, error } =
    await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginRedirect(
      origin,
      humanizeLoginErrorMessage(error.message),
      searchParams.get("next"),
    );
  }

  return finishAuthRedirect(
    origin,
    next,
    sessionData,
    supabase,
    searchParams.get("next"),
  );
}
