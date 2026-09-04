import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { runNotificationDeliverCron } from "@/lib/notifications/notification-deliver-cron";
import { emitDueFollowUpPushEvents } from "@/lib/notifications/notification-follow-up-due-server";
import { emitDuePurchaseOrderDeliveryPushEvents } from "@/lib/notifications/notification-po-delivery-due-server";
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

  const payload = await withCronHeartbeat("notification-deliver", async () => {
    const followUpNotify = await emitDueFollowUpPushEvents(admin);
    const poDeliveryNotify = await emitDuePurchaseOrderDeliveryPushEvents(admin);
    const stats = await runNotificationDeliverCron(admin);
    return { ...stats, followUpNotify, poDeliveryNotify };
  });
  return Response.json(payload);
}

/** Fan-out + Zustellung für Push-Benachrichtigungen (z. B. Coolify-Cron alle 1–2 Min.). */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
