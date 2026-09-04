import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { evaluateWhatsappSloAlerts } from "@/lib/ops/evaluate-whatsapp-slo-alerts";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await withCronHeartbeat("reservation-whatsapp-slo", () =>
    evaluateWhatsappSloAlerts(admin),
  );
  return Response.json(result);
}
