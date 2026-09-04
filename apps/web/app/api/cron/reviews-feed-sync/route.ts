import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { runReviewsFeedSyncCron } from "@/lib/reviews/reviews-feed-sync-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Hintergrund-Sync externer Bewertungen (Google/Facebook) — Coolify-Cron alle 10 Min. */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("reviews-feed-sync", async () => {
    const result = await runReviewsFeedSyncCron(admin);
    return {
      restaurants: result.restaurants,
      syncedItems: result.syncedItems,
      skipped: result.skipped,
      errorCount: result.errors.length,
    };
  });
  return Response.json(stats);
}
