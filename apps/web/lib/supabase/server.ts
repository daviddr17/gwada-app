import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey } from "@/lib/public-env";
import {
  STAY_SIGNED_IN_COOKIE,
  mapAuthCookiesForStaySignedIn,
  resolveStaySignedInPreference,
} from "@/lib/auth/stay-signed-in";
import { resolveRequestOrigin } from "@/lib/navigation/request-origin";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

async function resolveSupabaseUrlForServer(): Promise<string> {
  const origin = await resolveRequestOrigin();
  return resolveSupabaseUrl(origin);
}

/**
 * Server Components, Server Actions, Route Handlers — always create per request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = await resolveSupabaseUrlForServer();
  const anonKey = getSupabaseAnonKey();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const staySignedIn = resolveStaySignedInPreference(
    cookieStore.get(STAY_SIGNED_IN_COOKIE)?.value,
  );

  return createServerClient(url, anonKey, {
    cookieOptions: gwadaSupabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of mapAuthCookiesForStaySignedIn(
            cookiesToSet,
            staySignedIn,
          )) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* Server Component — session refresh runs in `proxy.ts`. */
        }
      },
    },
  });
}
