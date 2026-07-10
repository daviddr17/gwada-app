import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { processDueEmailOutbox } from "@/lib/reservations/reservation-email-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const sb = createSupabaseAdminClient();
  if (!sb) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await processDueEmailOutbox(sb);
  return Response.json(stats);
}
