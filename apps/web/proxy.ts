import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";
import {
  appendAuthEntryCookieCleanup,
  stripBloatedCookiesFromCookieHeader,
} from "@/lib/cookies/bloated-request-cookies";
import {
  isAppRscRequest,
  logDashboardRscRequest,
} from "@/lib/observability/rsc-soft-nav-log";
import { isPublicRestaurantProfilePath } from "@/lib/restaurant/reserved-restaurant-slugs";
import { isSuperadminAppPath } from "@/lib/superadmin/superadmin-session";

function isAuthEntryPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/auth/callback" || pathname === "/auth/enter") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return true;
  if (pathname === "/impressum" || pathname.startsWith("/impressum/")) return true;
  if (pathname === "/datenschutz" || pathname.startsWith("/datenschutz/")) return true;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/embed/")) return true;
  if (pathname.startsWith("/display/")) return true;
  if (pathname.startsWith("/einladung/")) return true;
  if (pathname.startsWith("/bewertung/")) return true;
  if (pathname.startsWith("/nachrichten/")) return true;
  if (pathname.startsWith("/sb")) return true;
  if (isPublicRestaurantProfilePath(pathname)) return true;
  return false;
}

/** RSC/App-Render: bloated gwada_*-Cookies aus Request entfernen (Session bleibt). */
function slimAuthenticatedCookieRequest(request: NextRequest): NextRequest {
  const raw = request.headers.get("cookie");
  const stripped = stripBloatedCookiesFromCookieHeader(raw);
  if (!stripped || stripped === raw) return request;

  const headers = new Headers(request.headers);
  headers.set("cookie", stripped);
  return new NextRequest(request.url, { headers, method: request.method });
}

/** Auth & öffentliche Routen — Next.js 16: `proxy.ts` (ersetzt `middleware.ts`). */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const anonKey = getSupabaseAnonKey();

  if (!anonKey) {
    if (!isPublicPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  const earlyResponse = NextResponse.next({ request });

  if (isAuthEntryPath(pathname)) {
    appendAuthEntryCookieCleanup(earlyResponse.headers);
  }

  if (
    isAuthEntryPath(pathname) ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/") ||
    pathname === "/impressum" ||
    pathname.startsWith("/impressum/") ||
    pathname === "/datenschutz" ||
    pathname.startsWith("/datenschutz/") ||
    pathname.startsWith("/embed/") ||
    pathname.startsWith("/display/") ||
    pathname.startsWith("/api/display/") ||
    pathname.startsWith("/einladung/") ||
    pathname.startsWith("/bewertung/") ||
    pathname.startsWith("/nachrichten/") ||
    isPublicRestaurantProfilePath(pathname)
  ) {
    return earlyResponse;
  }

  const forwardRequest = slimAuthenticatedCookieRequest(request);
  const response = NextResponse.next({ request: forwardRequest });

  const supabase = createServerClient(resolveSupabaseUrl(request.nextUrl.origin), anonKey, {
    cookieOptions: gwadaSupabaseCookieOptions,
    cookies: {
      getAll() {
        return forwardRequest.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // RSC-Soft-Nav: Session aus JWT (lokal) — kein Roundtrip zu auth/v1/user pro Klick.
  // Volle Document-Loads + Superadmin: getUser() zur Server-Validierung.
  const useStrictAuth =
    !isAppRscRequest(request) || isSuperadminAppPath(pathname);
  const user = useStrictAuth
    ? (await supabase.auth.getUser()).data.user ?? null
    : (await supabase.auth.getSession()).data.session?.user ?? null;

  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/login") && user) {
      const dest = safeInternalPath(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    loginUrl.searchParams.set("reason", "reauth");
    return NextResponse.redirect(loginUrl);
  }

  if (isSuperadminAppPath(pathname)) {
    const { data: isSuper, error } = await supabase.rpc("auth_is_superadmin");
    if (error || !isSuper) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Legacy-OAuth-Cookies schrumpfen (Live: zu große Cookie-Header → RSC-Soft-Nav schlägt fehl).
  appendAuthEntryCookieCleanup(response.headers);

  logDashboardRscRequest(request, pathname);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sb(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
