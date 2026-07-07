import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchTableLatestUpdatedAt } from "@/lib/display/display-module-live-revision";

export async function loadDisplayTimeLiveRevision(
  restaurantId: string,
): Promise<{ revision: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { revision: "" };

  const [workEntries, timeRequests] = await Promise.all([
    fetchTableLatestUpdatedAt(
      admin,
      "restaurant_staff_work_entries",
      restaurantId,
    ),
    fetchTableLatestUpdatedAt(
      admin,
      "restaurant_staff_display_time_requests",
      restaurantId,
    ),
  ]);

  const parts = [workEntries, timeRequests].filter(Boolean);
  return { revision: parts.sort().join("|") };
}
