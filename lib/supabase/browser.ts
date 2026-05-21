import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { gwadaSupabaseCookieOptions } from "@/lib/supabase/ssr-cookie-options";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

/**
 * Browser / Client Components — call from event handlers, effects, etc.
 */
export function createSupabaseBrowserClient() {
  const url = resolveSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anonKey, {
    cookieOptions: gwadaSupabaseCookieOptions,
  });
}
