import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { scheduleNotificationDeliverForEvent } from "@/lib/notifications/schedule-notification-deliver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MODULE_BY_STATUS = {
  ordered: "inventory_po_ordered",
  closed: "inventory_po_closed",
} as const;

/** Sofort-Push nach Statuswechsel. Cron bleibt Fallback, falls der Kick ausfällt. */
export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    orderId?: string;
    status?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = body.orderId?.trim() ?? "";
  const status = body.status === "ordered" || body.status === "closed" ? body.status : null;
  if (!orderId || !status) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("notification_events")
    .select("id")
    .eq("restaurant_id", auth.restaurantId)
    .eq("module", MODULE_BY_STATUS[status])
    .contains("payload", { orderId })
    .gte("created_at", since)
    .is("processed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[po-status-deliver] lookup", error.message);
    return Response.json({ ok: false }, { status: 200 });
  }

  const eventId = (data as { id?: string } | null)?.id;
  if (eventId) {
    scheduleNotificationDeliverForEvent(admin, eventId);
  }

  return Response.json({ ok: true });
}
