import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabaseUrl } from "@/lib/supabase/resolve-url";

/**
 * Browser / Client Components — call from event handlers, effects, etc.
 */
export function createSupabaseBrowserClient() {
  const url = resolveSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anonKey);
}
