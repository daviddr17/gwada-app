import { runNewsFeedSyncCron } from "@/lib/news/news-feed-sync-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runNewsFeedSyncCron(admin);
  return Response.json(stats);
}
