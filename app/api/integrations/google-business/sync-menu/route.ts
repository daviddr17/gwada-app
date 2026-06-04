import { syncMenuToGoogleBusiness } from "@/lib/integrations/google-business-menu-sync-server";
import { authorizeGoogleBusinessRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { restaurantId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeGoogleBusinessRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await syncMenuToGoogleBusiness(restaurantId);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true, itemCount: result.itemCount });
}
