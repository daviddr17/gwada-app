import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runMetaInboxSyncCron } from "@/lib/contacts/sync-all-restaurants-meta-inbox-cron";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Täglicher Facebook/Instagram-Messaging-Sync in contact_messages. */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("meta-inbox-sync", async () => {
    const result = await runMetaInboxSyncCron(admin);
    return {
      restaurants: result.restaurants,
      facebookImported: result.facebookImported,
      instagramImported: result.instagramImported,
      errorCount: result.errors.length,
    };
  });
  return Response.json(stats);
}
