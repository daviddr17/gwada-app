import "server-only";

import {
  DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS,
  GUEST_CONTACT_REQUIREMENTS_SELECT,
  guestContactRequirementSettingsFromRow,
  validateGuestContactRequirements,
  type GuestContactRequirementSettings,
} from "@/lib/reservations/guest-contact-requirements";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchGuestContactRequirementSettings(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<GuestContactRequirementSettings> {
  const { data } = await admin
    .from("restaurant_reservation_settings")
    .select(GUEST_CONTACT_REQUIREMENTS_SELECT)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return guestContactRequirementSettingsFromRow(
    data as Parameters<typeof guestContactRequirementSettingsFromRow>[0],
  );
}

export async function assertStaffGuestContactRequirements(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    partySize: number;
    phone: string | null | undefined;
    email: string | null | undefined;
    skip?: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: "email_required" | "phone_required" }> {
  if (params.skip) return { ok: true };

  const settings =
    (await fetchGuestContactRequirementSettings(admin, params.restaurantId)) ??
    DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS;

  return validateGuestContactRequirements(
    settings,
    params.partySize,
    params.phone,
    params.email,
  );
}
