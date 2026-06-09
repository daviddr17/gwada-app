import { getLexofficeContactsIntegrationStatus } from "@/lib/contacts/contacts-server";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const integration = await getLexofficeContactsIntegrationStatus(
    sb,
    restaurantId,
  );

  return Response.json(integration);
}
