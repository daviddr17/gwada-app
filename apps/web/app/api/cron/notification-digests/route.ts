import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";
import { DIGEST_MODULE_IDS, runNotificationDigestCron } from "@/lib/notifications/notification-digest-server";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handleCron(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await withCronHeartbeat("notification-digests", async () => {
    return runNotificationDigestCron(admin);
  });

  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: events } = await admin
    .from("notification_events")
    .select("restaurant_id, reference_id, module")
    .in("module", [...DIGEST_MODULE_IDS])
    .is("processed_at", null)
    .gte("created_at", since);

  const byRestaurant = new Map<string, { module: string; referenceIds: string[] }[]>();
  for (const row of events ?? []) {
    const event = row as {
      restaurant_id: string;
      reference_id: string;
      module: string;
    };
    const list = byRestaurant.get(event.restaurant_id) ?? [];
    const existing = list.find((item) => item.module === event.module);
    if (existing) existing.referenceIds.push(event.reference_id);
    else list.push({ module: event.module, referenceIds: [event.reference_id] });
    byRestaurant.set(event.restaurant_id, list);
  }

  for (const [restaurantId, groups] of byRestaurant) {
    for (const group of groups) {
      await scheduleDeliverForNotificationReferences(admin, {
        restaurantId,
        module: group.module,
        referenceIds: group.referenceIds,
      });
    }
  }

  return Response.json(stats);
}

/** Stündlich: Tages-/Wochenvorschau und -rückblick, wenn die lokale Stunde passt. */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
