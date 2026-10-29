import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey } from "@/lib/public-env";
import {
  mapAuthCookiesForStaySignedIn,
  readStaySignedInPreference,
} from "@/lib/auth/stay-signed-in";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

let browserClient: SupabaseClient | null = null;

/**
 * Browser / Client Components — Singleton pro Tab (weniger GoTrue-Listener-Duplikate).
 * setAll respektiert „Angemeldet bleiben“ (Session- vs. Persistenz-Cookies).
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = resolveSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  browserClient = createBrowserClient(url, anonKey, {
    cookieOptions: gwadaSupabaseCookieOptions,
    cookies: {
      getAll() {
        if (typeof document === "undefined") return [];
        const parsed = parse(document.cookie);
        return Object.keys(parsed).map((name) => ({
          name,
          value: parsed[name] ?? "",
        }));
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") {
          throw new Error(
            "createSupabaseBrowserClient: Auth-Cookies können nur im Browser gesetzt werden.",
          );
        }
        const staySignedIn = readStaySignedInPreference();
        for (const { name, value, options } of mapAuthCookiesForStaySignedIn(
          cookiesToSet,
          staySignedIn,
        )) {
          document.cookie = serialize(name, value, options);
        }
      },
    },
    auth: {
      experimental: { passkey: true },
    },
  });

  return browserClient;
}
