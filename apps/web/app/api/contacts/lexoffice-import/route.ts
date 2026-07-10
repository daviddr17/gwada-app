import { authorizeContactsRestaurant } from "@/lib/contacts/route-auth";
import { importLexofficeContactToGwadaServer } from "@/lib/contacts/contacts-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    lexofficeContactId?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  const lexofficeContactId = body.lexofficeContactId?.trim() ?? "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(lexofficeContactId)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const result = await importLexofficeContactToGwadaServer(
    sb,
    restaurantId,
    lexofficeContactId,
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
