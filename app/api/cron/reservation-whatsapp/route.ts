import { processDueWhatsappOutbox } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Geplante Erinnerungen / Danke-Nachrichten (z. B. Coolify-Cron alle 5 Min.). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sb = createSupabaseAdminClient();
  if (!sb) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await processDueWhatsappOutbox(sb);
  return Response.json(stats);
}
