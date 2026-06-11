import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { isNotificationModuleId } from "@/lib/notifications/notification-modules";
import { markNotificationReadServer } from "@/lib/notifications/notification-mark-read-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    restaurantId?: string;
    module?: string;
    itemId?: string | null;
    meta?: Record<string, string>;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!body.module || !isNotificationModuleId(body.module)) {
    return Response.json({ error: "invalid_module" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const result = await markNotificationReadServer(sb, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    module: body.module,
    itemId: body.itemId,
    meta: body.meta,
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "failed" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
