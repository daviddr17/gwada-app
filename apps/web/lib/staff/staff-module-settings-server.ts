import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function fetchStaffModuleSettingsServer(
  restaurantId: string,
): Promise<{
  contractTwoStepSigning: boolean;
  profileAllowDisplayPinSelfService: boolean;
}> {
  if (!isUuidRestaurantId(restaurantId)) {
    return {
      contractTwoStepSigning: false,
      profileAllowDisplayPinSelfService: false,
    };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      contractTwoStepSigning: false,
      profileAllowDisplayPinSelfService: false,
    };
  }

  const { data } = await admin
    .from("restaurant_staff_module_settings")
    .select(
      "contract_two_step_signing, profile_allow_display_pin_self_service",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return {
    contractTwoStepSigning: Boolean(data?.contract_two_step_signing),
    profileAllowDisplayPinSelfService: Boolean(
      data?.profile_allow_display_pin_self_service,
    ),
  };
}
