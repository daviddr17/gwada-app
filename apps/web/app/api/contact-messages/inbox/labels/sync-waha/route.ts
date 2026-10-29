import { syncInboxLabelsFromWahaServer } from "@/lib/contact-messages/inbox-labels-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
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

  const result = await syncInboxLabelsFromWahaServer(admin, restaurantId);
  if (!result.ok) {
    return Response.json(
      { error: result.error ?? "sync_failed" },
      { status: 502 },
    );
  }
  return Response.json({
    ok: true,
    imported: result.imported,
    linked: result.linked,
  });
}
