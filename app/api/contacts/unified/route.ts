import {
  fetchContactsForRestaurantServer,
  getLexofficeContactsIntegrationStatus,
  loadLexofficeContactsForRestaurant,
} from "@/lib/contacts/contacts-server";
import { buildUnifiedContactList } from "@/lib/contacts/build-unified-contacts-server";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import { fetchContactLexofficeLinks } from "@/lib/supabase/contact-lexoffice-links-db";
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

  const { data: gwadaRows, error } = await fetchContactsForRestaurantServer(
    sb,
    restaurantId,
  );
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let lexofficeContacts: Awaited<
    ReturnType<typeof loadLexofficeContactsForRestaurant>
  > = { ok: false, contacts: [] };
  let lexofficeError: string | null = null;

  if (integration.connected) {
    lexofficeContacts = await loadLexofficeContactsForRestaurant(
      sb,
      restaurantId,
    );
    if (!lexofficeContacts.ok) {
      lexofficeError =
        lexofficeContacts.error ?? "Lexware-Kontakte nicht ladbar.";
    }
  }

  const links = integration.connected
    ? await fetchContactLexofficeLinks(sb, restaurantId)
    : [];

  const items = buildUnifiedContactList({
    gwadaRows,
    lexofficeContacts: lexofficeContacts.contacts,
    links,
  });

  return Response.json({
    items,
    integration,
    lexofficeError,
  });
}
