import type { SupabaseClient } from "@supabase/supabase-js";

/** Aktualisiert `profiles.last_seen_at` für den eingeloggten User. */
export async function touchProfileLastSeen(
  sb: SupabaseClient,
): Promise<void> {
  const { error } = await sb.rpc("touch_profile_last_seen");
  if (error) {
    console.warn("touch_profile_last_seen", error.message);
  }
}
