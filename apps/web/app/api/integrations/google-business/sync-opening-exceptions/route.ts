import { syncOpeningHoursToGoogleBusiness } from "@/lib/integrations/google-business-hours-sync-server";
import {
  authorizeGoogleBusinessRestaurantRoute,
  authorizeOpeningHoursSettingsRoute,
} from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { restaurantId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  const hoursAuth = await authorizeOpeningHoursSettingsRoute(restaurantId);
  if (!hoursAuth.ok) {
    return Response.json({ error: hoursAuth.error }, { status: hoursAuth.status });
  }

  const googleAuth = await authorizeGoogleBusinessRestaurantRoute(restaurantId);
  if (!googleAuth.ok) {
    return Response.json({ error: googleAuth.error }, { status: googleAuth.status });
  }

  const result = await syncOpeningHoursToGoogleBusiness(restaurantId, "exceptions");
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
