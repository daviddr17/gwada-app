import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runDailyBillingHealthCheck } from "@/lib/billing/daily-billing-health";
import { isBillingPastDueSweepDue } from "@/lib/billing/past-due-grace";
import { runNewsFeedSyncCron } from "@/lib/news/news-feed-sync-cron";
import {
  recordCronHeartbeat,
  withCronHeartbeat,
} from "@/lib/ops/record-cron-heartbeat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Hintergrund-Sync externer News-Feeds — VPS-Crontab alle 10 Min. (siehe docs/cron-jobs.md). */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("news-feed-sync", async () => {
    const billing = isBillingPastDueSweepDue()
      ? await runDailyBillingHealthCheck()
      : undefined;
    if (billing) {
      await recordCronHeartbeat({
        jobName: "billing-past-due",
        ok: billing.failed === 0,
        payload: {
          stripeListed: billing.stripeListed,
          synced: billing.synced,
          failed: billing.failed,
        },
        error: billing.failed ? `${billing.failed} sync failed` : null,
      });
    }
    const result = await runNewsFeedSyncCron(admin);
    return {
      restaurants: result.restaurants,
      syncedItems: result.syncedItems,
      skipped: result.skipped,
      errorCount: result.errors.length,
      billing,
    };
  });
  return Response.json(stats);
}
