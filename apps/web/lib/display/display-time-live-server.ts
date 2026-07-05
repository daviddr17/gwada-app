import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchTableLatestUpdatedAt } from "@/lib/display/display-module-live-revision";

export async function loadDisplayTimeLiveRevision(
  restaurantId: string,
): Promise<{ revision: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { revision: "" };

  const latest = await fetchTableLatestUpdatedAt(
    admin,
    "restaurant_staff_work_entries",
    restaurantId,
  );

  return { revision: latest ?? "" };
}
