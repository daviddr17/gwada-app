import { patchContactMissingFieldsServer } from "@/lib/contacts/contacts-server";
import type { ContactRecipientFieldKey } from "@/lib/accounting/accounting-contact-recipient";
import { authorizeContactsRestaurant } from "@/lib/contacts/route-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    gwadaContactId?: string | null;
    lexofficeContactId?: string | null;
    originallyEmpty?: Partial<Record<ContactRecipientFieldKey, boolean>>;
    recipient?: {
      name?: string;
      street?: string | null;
      zip?: string | null;
      city?: string | null;
      countryCode?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    base?: {
      first_name?: string;
      last_name?: string;
      company?: string | null;
      address_street?: string | null;
      address_postal_code?: string | null;
      address_city?: string | null;
      address_country?: string | null;
      emails?: string[];
      phones?: string[];
    };
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const originallyEmpty = body.originallyEmpty ?? {};
  const recipient = body.recipient ?? {};
  const base = body.base ?? {};

  const patch: {
    name?: string;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  } = {};

  if (originallyEmpty.name && recipient.name?.trim()) {
    patch.name = recipient.name.trim();
  }
  if (originallyEmpty.street && recipient.street?.trim()) {
    patch.street = recipient.street.trim();
  }
  if (originallyEmpty.zip && recipient.zip?.trim()) {
    patch.zip = recipient.zip.trim();
  }
  if (originallyEmpty.city && recipient.city?.trim()) {
    patch.city = recipient.city.trim();
  }
  if (originallyEmpty.country && recipient.countryCode?.trim()) {
    patch.country = recipient.countryCode.trim();
  }
  if (originallyEmpty.email && recipient.email?.trim()) {
    patch.email = recipient.email.trim();
  }
  if (originallyEmpty.phone && recipient.phone?.trim()) {
    patch.phone = recipient.phone.trim();
  }

  const sb = await createSupabaseServerClient();
  const result = await patchContactMissingFieldsServer(sb, {
    restaurantId,
    gwadaContactId: body.gwadaContactId ?? null,
    lexofficeContactId: body.lexofficeContactId ?? null,
    base: {
      first_name: base.first_name ?? "",
      last_name: base.last_name ?? "",
      company: base.company ?? null,
      address_street: base.address_street ?? null,
      address_postal_code: base.address_postal_code ?? null,
      address_city: base.address_city ?? null,
      address_country: base.address_country ?? null,
      emails: base.emails ?? [],
      phones: base.phones ?? [],
    },
    patch,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({
    ok: true,
    contactId: result.contactId || null,
    updatedFields: result.updatedFields,
  });
}
