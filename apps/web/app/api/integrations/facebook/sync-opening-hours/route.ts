import { syncOpeningHoursToFacebook } from "@/lib/integrations/facebook-hours-sync-server";
import { authorizeOpeningHoursSettingsRoute } from "@/lib/integrations/oauth-route-auth";
import { assertPlatformFacebookEnabled } from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const sb = await createSupabaseServerClient();
  const platform = await assertPlatformFacebookEnabled(sb);
  if (!platform.ok) {
    return Response.json({ error: platform.error }, { status: 403 });
  }

  const result = await syncOpeningHoursToFacebook(restaurantId);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
