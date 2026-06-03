import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { resolveRequestOriginFromRequest } from "@/lib/navigation/request-origin";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";
import { appendAuthEntryCookieCleanup } from "@/lib/cookies/bloated-request-cookies";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = resolveRequestOriginFromRequest(request);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return loginRedirect(origin, oauthError, searchParams.get("next"));
  }

  if (!code) {
    return loginRedirect(origin, "Anmeldung abgebrochen oder unvollständig.");
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginRedirect(origin, error.message, searchParams.get("next"));
  }

  const enterUrl = new URL(
    `/auth/enter?next=${encodeURIComponent(next)}`,
    origin,
  );
  const headers = new Headers({ Location: enterUrl.toString() });
  appendAuthEntryCookieCleanup(headers);
  return new NextResponse(null, { status: 302, headers });
}
