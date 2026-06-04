import { loadOpeningHoursPlatformStatus } from "@/lib/integrations/opening-hours-platform-status-server";
import { authorizeOpeningHoursSettingsRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeOpeningHoursSettingsRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await loadOpeningHoursPlatformStatus(restaurantId);
  if ("error" in result) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json(result);
}
