import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { processDueScheduledNewsPosts } from "@/lib/news/news-scheduled-publish-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const sb = createSupabaseAdminClient();
  if (!sb) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await processDueScheduledNewsPosts(sb);
  return Response.json(stats);
}
