import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function fetchStaffModuleSettingsServer(
  restaurantId: string,
): Promise<{ contractTwoStepSigning: boolean }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { contractTwoStepSigning: false };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { contractTwoStepSigning: false };

  const { data } = await admin
    .from("restaurant_staff_module_settings")
    .select("contract_two_step_signing")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return {
    contractTwoStepSigning: Boolean(data?.contract_two_step_signing),
  };
}
