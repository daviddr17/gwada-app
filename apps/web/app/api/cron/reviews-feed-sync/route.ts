import { assertCronAuthorized } from "@/lib/api/cron-auth";
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

  const stats = await runReviewsFeedSyncCron(admin);
  return Response.json(stats);
}
