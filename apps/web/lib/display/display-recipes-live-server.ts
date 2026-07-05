import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  composeDisplayLiveRevision,
  fetchTableLatestUpdatedAt,
} from "@/lib/display/display-module-live-revision";

export async function loadDisplayRecipesLiveRevision(
  restaurantId: string,
): Promise<{ revision: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { revision: "" };

  const [items, categories] = await Promise.all([
    fetchTableLatestUpdatedAt(admin, "menu_items", restaurantId),
    fetchTableLatestUpdatedAt(admin, "menu_categories", restaurantId),
  ]);

  return {
    revision: composeDisplayLiveRevision([items, categories]),
  };
}
