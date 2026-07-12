import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
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

  const { data: events } = await admin
    .from("notification_events")
    .select("restaurant_id, reference_id, module")
    .in("module", ["staff_shift_start", "staff_shift_end"])
    .is("processed_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const byRestaurant = new Map<string, { module: string; referenceIds: string[] }[]>();
  for (const row of events ?? []) {
    const r = row as {
      restaurant_id: string;
      reference_id: string;
      module: string;
    };
    const key = r.restaurant_id;
    const list = byRestaurant.get(key) ?? [];
    const existing = list.find((e) => e.module === r.module);
    if (existing) {
      existing.referenceIds.push(r.reference_id);
    } else {
      list.push({ module: r.module, referenceIds: [r.reference_id] });
    }
    byRestaurant.set(key, list);
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

/** Schichtbeginn/-ende → notification_events (z. B. Cron alle 5 Min.). */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
