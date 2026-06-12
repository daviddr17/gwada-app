import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

let browserClient: SupabaseClient | null = null;

/**
 * Browser / Client Components — Singleton pro Tab (weniger GoTrue-Listener-Duplikate).
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
  });

  return browserClient;
}
