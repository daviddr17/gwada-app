import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runNewsFeedSyncCron } from "@/lib/news/news-feed-sync-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Hintergrund-Sync externer News-Feeds — Coolify-Cron alle 10 Min. (siehe docs/cron-jobs.md). */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runNewsFeedSyncCron(admin);
  return Response.json(stats);
}
