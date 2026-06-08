import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

let adminClient: SupabaseClient | null = null;
let adminClientKey: string | null = null;

/** Server-only (Cron, WhatsApp-Versand, POS Bearer-Auth). */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    resolveSupabaseUpstreamUrl()
  ).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!adminClient || adminClientKey !== key) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    adminClientKey = key;
  }
  return adminClient;
}
