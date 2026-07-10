import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runContactInboxSyncCron } from "@/lib/contacts/sync-all-restaurants-inbox-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runContactInboxSyncCron(admin);
  return Response.json(stats);
}
