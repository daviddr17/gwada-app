import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { raceWithTimeout, GWADA_SUPABASE_FETCH_TIMEOUT_MS } from "@/lib/supabase/race-timeout";
import {
  getWorkspaceRestaurantId,
  workspacePersistenceConfigured,
} from "@/lib/supabase/workspace-persistence";

/**
 * Einmaliges Lesen aus `restaurant_app_state` (vor Tabellen-Entfernung).
 * Gibt `null` zurück, wenn die Tabelle nicht mehr existiert oder kein Eintrag da ist.
 */
export async function readLegacyRestaurantAppStatePayload(
  storageKey: string,
): Promise<unknown | null> {
  if (!workspacePersistenceConfigured()) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    const restaurantId = await getWorkspaceRestaurantId();
    if (!restaurantId) return null;
    const { data, error } = await raceWithTimeout(
      supabase
        .from("restaurant_app_state")
        .select("payload")
        .eq("restaurant_id", restaurantId)
        .eq("storage_key", storageKey)
        .maybeSingle(),
      GWADA_SUPABASE_FETCH_TIMEOUT_MS,
      "Legacy restaurant_app_state lesen",
    );
    if (error || !data) return null;
    return data.payload as unknown;
  } catch (e) {
    console.warn("[gwada] readLegacyRestaurantAppStatePayload", storageKey, e);
    return null;
  }
}
