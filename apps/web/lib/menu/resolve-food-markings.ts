import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  foodMarkingsForCountry,
  type FoodMarkingDefinition,
} from "@/lib/menu/food-marking-catalog";
import {
  fetchPlatformFoodMarkings,
  platformFoodMarkingToDefinition,
} from "@/lib/supabase/platform-food-markings-db";

/**
 * DB-Liste fürs Land, Fallback auf Seed (#616 catalog), wenn leer/Fehler.
 */
export async function resolveFoodMarkingsForCountry(
  client: SupabaseClient | null | undefined,
  countryIso2: string | null | undefined,
): Promise<FoodMarkingDefinition[]> {
  const seed = foodMarkingsForCountry(countryIso2);
  if (!client) return seed;

  const country =
    typeof countryIso2 === "string" && countryIso2.trim()
      ? countryIso2.trim().toUpperCase()
      : "DE";

  const { markings, error } = await fetchPlatformFoodMarkings(client, {
    countryCode: country,
    activeOnly: true,
  });

  if (error || markings.length === 0) {
    return seed;
  }

  return markings.map(platformFoodMarkingToDefinition);
}
