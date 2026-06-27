import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { parseProfileVisibility } from "@/lib/profile/profile-nav";
import { insertDocumentTag } from "@/lib/supabase/documents-db";

export type RestaurantStaffModuleSettingsRow = {
  restaurant_id: string;
  contract_document_tag_id: string | null;
  profile_show_work_hours: boolean;
  profile_show_shift_plan: boolean;
  profile_show_documents: boolean;
  profile_allow_display_pin_self_service: boolean;
  contract_two_step_signing: boolean;
};

export const STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME = "Mitarbeiter";

export async function fetchStaffModuleSettings(
  restaurantId: string,
): Promise<{ data: RestaurantStaffModuleSettingsRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: null, error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_module_settings")
    .select(
      "restaurant_id, contract_document_tag_id, profile_show_work_hours, profile_show_shift_plan, profile_show_documents, profile_allow_display_pin_self_service, contract_two_step_signing",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  if (!data) {
    return {
      data: {
        restaurant_id: restaurantId,
        contract_document_tag_id: null,
        ...parseProfileVisibility(null),
        contract_two_step_signing: false,
      },
      error: null,
    };
  }

  return {
    data: {
      ...(data as RestaurantStaffModuleSettingsRow),
      ...parseProfileVisibility(data as Partial<RestaurantStaffModuleSettingsRow>),
      contract_two_step_signing:
        (data as { contract_two_step_signing?: boolean }).contract_two_step_signing ??
        false,
    },
    error: null,
  };
}

export async function upsertStaffModuleSettings(params: {
  restaurantId: string;
  contractDocumentTagId: string | null;
  profileShowWorkHours?: boolean;
  profileShowShiftPlan?: boolean;
  profileShowDocuments?: boolean;
  profileAllowDisplayPinSelfService?: boolean;
  contractTwoStepSigning?: boolean;
}): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { error: new Error("Ungültige Restaurant-ID.") };
  }
  const sb = createSupabaseBrowserClient();

  const patch: Record<string, unknown> = {
    restaurant_id: params.restaurantId,
    contract_document_tag_id: params.contractDocumentTagId,
  };
  if (params.profileShowWorkHours !== undefined) {
    patch.profile_show_work_hours = params.profileShowWorkHours;
  }
  if (params.profileShowShiftPlan !== undefined) {
    patch.profile_show_shift_plan = params.profileShowShiftPlan;
  }
  if (params.profileShowDocuments !== undefined) {
    patch.profile_show_documents = params.profileShowDocuments;
  }
  if (params.profileAllowDisplayPinSelfService !== undefined) {
    patch.profile_allow_display_pin_self_service =
      params.profileAllowDisplayPinSelfService;
  }
  if (params.contractTwoStepSigning !== undefined) {
    patch.contract_two_step_signing = params.contractTwoStepSigning;
  }

  const { error } = await sb
    .from("restaurant_staff_module_settings")
    .upsert(patch, { onConflict: "restaurant_id" });
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Tag für Vertrags-PDFs — aus Einstellungen oder auto „Mitarbeiter“. */
export async function resolveStaffContractDocumentTagId(
  restaurantId: string,
): Promise<{ tagId: string | null; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { tagId: null, error: new Error("Ungültige Restaurant-ID.") };
  }

  const { data, error } = await fetchStaffModuleSettings(restaurantId);
  if (error) return { tagId: null, error };

  if (data?.contract_document_tag_id) {
    return { tagId: data.contract_document_tag_id, error: null };
  }

  const sb = createSupabaseBrowserClient();
  const { data: existingTag } = await sb
    .from("restaurant_document_tags")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME)
    .maybeSingle();

  if (existingTag?.id) {
    const tagId = existingTag.id as string;
    await upsertStaffModuleSettings({
      restaurantId,
      contractDocumentTagId: tagId,
    });
    return { tagId, error: null };
  }

  const created = await insertDocumentTag(
    restaurantId,
    STAFF_CONTRACT_DEFAULT_DOCUMENT_TAG_NAME,
    true,
    "#64748b",
  );
  if (!created) {
    return {
      tagId: null,
      error: new Error("Dokument-Tag konnte nicht angelegt werden."),
    };
  }

  await upsertStaffModuleSettings({
    restaurantId,
    contractDocumentTagId: created.id,
  });

  return { tagId: created.id, error: null };
}
