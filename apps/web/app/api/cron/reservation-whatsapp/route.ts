import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { processDueWhatsappOutbox } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Geplante Erinnerungen / Danke — GitHub Actions production-cron.yml alle 5 Min. */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const sb = createSupabaseAdminClient();
  if (!sb) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("reservation-whatsapp", () =>
    processDueWhatsappOutbox(sb),
  );
  return Response.json(stats);
}
