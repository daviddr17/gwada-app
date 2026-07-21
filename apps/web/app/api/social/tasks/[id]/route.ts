import { authorizeSocialBrandKitRestaurant } from "@/lib/social/route-auth";
import { completeSocialTaskInDb } from "@/lib/social/social-suggestions-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    status?: "done" | "dismissed";
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const status = body.status === "dismissed" ? "dismissed" : "done";

  const auth = await authorizeSocialBrandKitRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await completeSocialTaskInDb(admin, {
    restaurantId,
    taskId,
    status,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
