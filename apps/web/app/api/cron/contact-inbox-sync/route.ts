import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runContactInboxSyncCron } from "@/lib/contacts/sync-all-restaurants-inbox-cron";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("contact-inbox-sync", async () => {
    const result = await runContactInboxSyncCron(admin);
    return {
      restaurants: result.restaurants,
      emailImported: result.emailImported,
      whatsappImported: result.whatsappImported,
      lexofficeContactsSynced: result.lexofficeContactsSynced,
      errorCount: result.errors.length,
    };
  });
  return Response.json(stats);
}
