import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runStaffShiftNotificationsCron } from "@/lib/notifications/notification-staff-shift-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handleCron(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runStaffShiftNotificationsCron(admin);
  return Response.json(stats);
}

/** Schichtbeginn/-ende → notification_events (z. B. Coolify-Cron alle 5 Min.). */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
