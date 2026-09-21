import type { RestaurantReservationSettingsRow } from "@/lib/supabase/reservation-settings-db";

export type GuestContactRequirementSettings = {
  guestEmailRequiredEnabled: boolean;
  guestEmailRequiredMinPartySize: number;
  guestPhoneRequiredEnabled: boolean;
  guestPhoneRequiredMinPartySize: number;
};

export const GUEST_CONTACT_REQUIREMENTS_SELECT =
  "guest_email_required_enabled, guest_email_required_min_party_size, guest_phone_required_enabled, guest_phone_required_min_party_size";

export const DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS: GuestContactRequirementSettings =
  {
    guestEmailRequiredEnabled: false,
    guestEmailRequiredMinPartySize: 6,
    guestPhoneRequiredEnabled: false,
    guestPhoneRequiredMinPartySize: 6,
  };

export type GuestContactRequirementError =
  | "email_required"
  | "phone_required"
  | "contact_required";

function clampMinPartySize(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, Math.round(n)));
}

export function guestContactRequirementSettingsFromRow(
  row:
    | Partial<
        Pick<
          RestaurantReservationSettingsRow,
          | "guest_email_required_enabled"
          | "guest_email_required_min_party_size"
          | "guest_phone_required_enabled"
          | "guest_phone_required_min_party_size"
        >
      >
    | null
    | undefined,
): GuestContactRequirementSettings {
  if (!row) return { ...DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS };
  return {
    guestEmailRequiredEnabled: row.guest_email_required_enabled === true,
    guestEmailRequiredMinPartySize: clampMinPartySize(
      row.guest_email_required_min_party_size,
      DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS.guestEmailRequiredMinPartySize,
    ),
    guestPhoneRequiredEnabled: row.guest_phone_required_enabled === true,
    guestPhoneRequiredMinPartySize: clampMinPartySize(
      row.guest_phone_required_min_party_size,
      DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS.guestPhoneRequiredMinPartySize,
    ),
  };
}

export function guestContactRequirementSettingsFromPublicConfig(
  config: Partial<GuestContactRequirementSettings> | null | undefined,
): GuestContactRequirementSettings {
  if (!config) return { ...DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS };
  return {
    guestEmailRequiredEnabled: config.guestEmailRequiredEnabled === true,
    guestEmailRequiredMinPartySize: clampMinPartySize(
      config.guestEmailRequiredMinPartySize,
      DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS.guestEmailRequiredMinPartySize,
    ),
    guestPhoneRequiredEnabled: config.guestPhoneRequiredEnabled === true,
    guestPhoneRequiredMinPartySize: clampMinPartySize(
      config.guestPhoneRequiredMinPartySize,
      DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS.guestPhoneRequiredMinPartySize,
    ),
  };
}

function hasPhone(phone: string | null | undefined): boolean {
  return Boolean(phone?.trim());
}

function hasEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim());
}

export function validateGuestContactRequirements(
  settings: GuestContactRequirementSettings,
  partySize: number,
  phone: string | null | undefined,
  email: string | null | undefined,
): { ok: true } | { ok: false; error: "email_required" | "phone_required" } {
  if (
    settings.guestEmailRequiredEnabled &&
    partySize >= settings.guestEmailRequiredMinPartySize &&
    !hasEmail(email)
  ) {
    return { ok: false, error: "email_required" };
  }
  if (
    settings.guestPhoneRequiredEnabled &&
    partySize >= settings.guestPhoneRequiredMinPartySize &&
    !hasPhone(phone)
  ) {
    return { ok: false, error: "phone_required" };
  }
  return { ok: true };
}

export function validatePublicGuestContact(
  settings: GuestContactRequirementSettings,
  partySize: number,
  phone: string | null | undefined,
  email: string | null | undefined,
): { ok: true } | { ok: false; error: GuestContactRequirementError } {
  const strict = validateGuestContactRequirements(
    settings,
    partySize,
    phone,
    email,
  );
  if (!strict.ok) return strict;

  const anyRuleActive =
    (settings.guestEmailRequiredEnabled &&
      partySize >= settings.guestEmailRequiredMinPartySize) ||
    (settings.guestPhoneRequiredEnabled &&
      partySize >= settings.guestPhoneRequiredMinPartySize);

  if (!anyRuleActive && !hasPhone(phone) && !hasEmail(email)) {
    return { ok: false, error: "contact_required" };
  }
  return { ok: true };
}

export function guestContactRequirementToastMessage(
  error: GuestContactRequirementError,
  settings: GuestContactRequirementSettings,
): string {
  switch (error) {
    case "email_required":
      return `Ab ${settings.guestEmailRequiredMinPartySize} Personen ist eine E-Mail-Adresse Pflicht.`;
    case "phone_required":
      return `Ab ${settings.guestPhoneRequiredMinPartySize} Personen ist eine Telefonnummer Pflicht.`;
    case "contact_required":
      return "Bitte Telefon oder E-Mail angeben.";
    default:
      return "Kontaktdaten unvollständig.";
  }
}

export function guestContactRequirementErrorMessage(
  error: string | null | undefined,
  settings?: GuestContactRequirementSettings | null,
): string | null {
  if (!error?.trim()) return null;
  const key = error.trim() as GuestContactRequirementError;
  if (
    key === "email_required" ||
    key === "phone_required" ||
    key === "contact_required"
  ) {
    return guestContactRequirementToastMessage(
      key,
      settings ?? DEFAULT_GUEST_CONTACT_REQUIREMENT_SETTINGS,
    );
  }
  return null;
}
