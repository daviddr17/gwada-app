import type { SupabaseClient } from "@supabase/supabase-js";

/** Max `updated_at` für Display-Live-Revision (Service-Role oder RLS). */
export async function fetchTableLatestUpdatedAt(
  sb: SupabaseClient,
  table: string,
  restaurantId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from(table)
    .select("updated_at")
    .eq("restaurant_id", restaurantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data.updated_at as string) ?? null;
}

export function composeDisplayLiveRevision(parts: (string | null | undefined)[]): string {
  return parts.map((p) => p ?? "").join("|");
}
