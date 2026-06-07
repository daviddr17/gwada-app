import type { SupabaseClient } from "@supabase/supabase-js";

export type PersonalProfileRowInput = {
  given_name: string;
  family_name: string;
  nickname: string | null;
  birth_date: string | null;
  address_line1: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string;
};

export function personalProfileDraftToRow(draft: {
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}): PersonalProfileRowInput {
  const bd = draft.birthDate.trim();
  const co = draft.country.trim() || "DE";
  return {
    given_name: draft.firstName.trim(),
    family_name: draft.lastName.trim(),
    nickname: draft.nickname.trim() || null,
    birth_date: bd ? bd : null,
    address_line1: draft.street.trim() || null,
    address_postal_code: draft.postalCode.trim() || null,
    address_city: draft.city.trim() || null,
    address_country: co,
  };
}

export function isPersonalProfileRowEmpty(row: {
  given_name: string | null;
  family_name: string | null;
  nickname: string | null;
  birth_date: string | null;
  address_line1: string | null;
  address_postal_code: string | null;
  address_city: string | null;
}): boolean {
  return (
    !row.given_name?.trim() &&
    !row.family_name?.trim() &&
    !row.nickname?.trim() &&
    !row.birth_date?.trim() &&
    !row.address_line1?.trim() &&
    !row.address_postal_code?.trim() &&
    !row.address_city?.trim()
  );
}

export async function updatePersonalProfileRow(
  sb: SupabaseClient,
  userId: string,
  row: PersonalProfileRowInput,
): Promise<{ ok: boolean; errorCode: string | null }> {
  const { error } = await sb.from("profiles").update(row).eq("id", userId);
  if (error) {
    return { ok: false, errorCode: error.code ?? null };
  }
  return { ok: true, errorCode: null };
}
