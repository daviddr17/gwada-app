import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runNotificationDeliverCron } from "@/lib/notifications/notification-deliver-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handleCron(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runNotificationDeliverCron(admin);
  return Response.json(stats);
}

/** Fan-out + Zustellung für Push-Benachrichtigungen (z. B. Coolify-Cron alle 1–2 Min.). */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
