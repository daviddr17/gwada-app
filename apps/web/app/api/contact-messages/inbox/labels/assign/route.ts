import { setInboxThreadLabelServer } from "@/lib/contact-messages/inbox-labels-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    threadKey?: string;
    labelId?: string;
    assigned?: boolean;
    syncWaha?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const threadKey = body.threadKey?.trim() ?? "";
  const labelId = body.labelId?.trim() ?? "";
  if (
    !isUuidRestaurantId(restaurantId) ||
    !threadKey ||
    !isUuidRestaurantId(labelId) ||
    typeof body.assigned !== "boolean"
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const write = await authorizeModuleCrud(restaurantId, "contacts", "update");
  if (!write.ok) {
    return Response.json({ error: write.error }, { status: write.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await setInboxThreadLabelServer(admin, {
    restaurantId,
    threadKey,
    labelId,
    assigned: body.assigned,
    syncWaha: body.syncWaha !== false,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
