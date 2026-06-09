import {
  insertContactServer,
  loadLexofficeContactsForRestaurant,
  resolveLexofficeContactsIntegration,
} from "@/lib/contacts/contacts-server";
import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  ContactEmailInput,
  ContactPhoneInput,
  ContactUpsertPayload,
} from "@/lib/supabase/contacts-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    syncToLexoffice?: boolean;
    linkExistingLexofficeId?: string | null;
    firstName?: string;
    lastName?: string;
    company?: string | null;
    addressStreet?: string | null;
    addressPostalCode?: string | null;
    addressCity?: string | null;
    addressCountry?: string | null;
    notes?: string | null;
    emails?: ContactEmailInput[];
    phones?: ContactPhoneInput[];
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const payload: ContactUpsertPayload = {
    restaurantId,
    firstName: body.firstName?.trim() || "Gast",
    lastName: body.lastName?.trim() ?? "",
    company: body.company ?? null,
    addressStreet: body.addressStreet ?? null,
    addressPostalCode: body.addressPostalCode ?? null,
    addressCity: body.addressCity ?? null,
    addressCountry: body.addressCountry ?? null,
    notes: body.notes ?? null,
    emails: body.emails ?? [],
    phones: body.phones ?? [],
  };

  if (payload.emails.length === 0 && payload.phones.length === 0) {
    return Response.json(
      { error: "Mindestens eine E-Mail oder Telefonnummer angeben." },
      { status: 400 },
    );
  }

  const sb = await createSupabaseServerClient();
  const syncToLexoffice = body.syncToLexoffice === true;

  let lexofficeApiKey: string | undefined;
  let lexofficeContactsCache: Awaited<
    ReturnType<typeof loadLexofficeContactsForRestaurant>
  >["contacts"] = [];

  if (syncToLexoffice || body.linkExistingLexofficeId) {
    const resolved = await resolveLexofficeContactsIntegration(sb, restaurantId);
    if (!resolved.ok) {
      return Response.json(
        { error: "Lexware Office ist nicht verbunden." },
        { status: 400 },
      );
    }
    lexofficeApiKey = resolved.apiKey;
    const loaded = await loadLexofficeContactsForRestaurant(sb, restaurantId);
    lexofficeContactsCache = loaded.contacts;
  } else {
    const loaded = await loadLexofficeContactsForRestaurant(sb, restaurantId);
    if (loaded.ok) {
      lexofficeContactsCache = loaded.contacts;
    }
  }

  const { data, error } = await insertContactServer(sb, payload, {
    syncToLexoffice,
    lexofficeApiKey,
    lexofficeContactsCache,
    linkExistingLexofficeId: body.linkExistingLexofficeId ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({
    ok: true,
    contactId: data?.id,
    lexofficeContactId: data?.lexofficeContactId ?? null,
  });
}
