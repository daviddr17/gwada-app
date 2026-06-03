import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";
import { appendAuthEntryCookieCleanup } from "@/lib/cookies/bloated-request-cookies";

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
  if (pathname.startsWith("/sb")) return true;
  return false;
}

/** Auth & öffentliche Routen — Next.js 16: `proxy.ts` (ersetzt `middleware.ts`). */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const response = NextResponse.next({ request });

  const anonKey = getSupabaseAnonKey();

  if (!anonKey) {
    if (!isPublicPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  if (isAuthEntryPath(pathname)) {
    appendAuthEntryCookieCleanup(response.headers);
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
    pathname.startsWith("/einladung/") ||
    pathname.startsWith("/bewertung/")
  ) {
    return response;
  }

  const supabase = createServerClient(resolveSupabaseUrl(request.nextUrl.origin), anonKey, {
    cookieOptions: gwadaSupabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sb(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
