import { authorizeEmailRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertRestaurantEmailIntegration } from "@/lib/supabase/restaurant-email-integration-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const auth = await authorizeEmailRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { error } = await upsertRestaurantEmailIntegration(
    admin,
    auth.ctx.restaurantId,
    {
      status: "default",
      config: {},
      last_error: null,
    },
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true, status: "default" });
}
