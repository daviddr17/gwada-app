import {
  fetchContactsForRestaurantServer,
  loadLexofficeContactsForRestaurant,
  resolveLexofficeContactsIntegration,
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
  const resolved = await resolveLexofficeContactsIntegration(sb, restaurantId);
  const integration = resolved.ok
    ? { platformEnabled: true, connected: true }
    : resolved.status;

  const { data: gwadaRows, error } = await fetchContactsForRestaurantServer(
    sb,
    restaurantId,
  );
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let lexofficeContactRows: Awaited<
    ReturnType<typeof loadLexofficeContactsForRestaurant>
  >["contacts"] = [];
  let lexofficeError: string | null = null;

  if (resolved.ok) {
    const forceRefresh =
      new URL(req.url).searchParams.get("refresh") === "1";
    const lexofficeContacts = await loadLexofficeContactsForRestaurant(
      sb,
      restaurantId,
      forceRefresh ? { forceRefresh: true } : undefined,
    );
    lexofficeContactRows = lexofficeContacts.contacts;
    if (!lexofficeContacts.ok) {
      lexofficeError = lexofficeContacts.error;
    }
  }

  const links = resolved.ok
    ? await fetchContactLexofficeLinks(sb, restaurantId)
    : [];

  const items = buildUnifiedContactList({
    gwadaRows,
    lexofficeContacts: lexofficeContactRows,
    links,
  });

  return Response.json({
    items,
    integration,
    lexofficeError,
  });
}
