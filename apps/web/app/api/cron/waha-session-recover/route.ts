import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runWahaSessionRecoverCron } from "@/lib/waha/waha-session-recover-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("waha-session-recover", () =>
    runWahaSessionRecoverCron(admin),
  );
  return Response.json(stats);
}
