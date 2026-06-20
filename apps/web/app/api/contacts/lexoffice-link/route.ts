import { getContactLexofficeLinkStatusServer } from "@/lib/contacts/contacts-server";
import { authorizeContactsRestaurant } from "@/lib/contacts/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const contactId = url.searchParams.get("contactId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId) || !isUuidRestaurantId(contactId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const result = await getContactLexofficeLinkStatusServer(
    sb,
    restaurantId,
    contactId,
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result.status);
}
