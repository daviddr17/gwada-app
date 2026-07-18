import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { processNewsletterOutbox } from "@/lib/newsletter/newsletter-send-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseUrl } from "@/lib/public-env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const sb = createSupabaseAdminClient();
  if (!sb) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const supabaseUrl = getPublicSupabaseUrl();
  if (!supabaseUrl) {
    return Response.json({ error: "supabase_url_missing" }, { status: 503 });
  }

  const stats = await processNewsletterOutbox({
    admin: sb,
    supabaseUrl,
  });
  return Response.json(stats);
}
