import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT,
  normalizeDisplayAutoClockOutHours,
  type StaffDisplayAutoClockOutPolicy,
} from "@/lib/staff/staff-display-auto-clock-out";

export type { StaffDisplayAutoClockOutPolicy };

export async function fetchStaffModuleSettingsServer(
  restaurantId: string,
): Promise<{
  contractTwoStepSigning: boolean;
  profileAllowDisplayPinSelfService: boolean;
  displayAutoClockOut: StaffDisplayAutoClockOutPolicy;
}> {
  const defaults = {
    contractTwoStepSigning: false,
    profileAllowDisplayPinSelfService: false,
    displayAutoClockOut: {
      enabled: true,
      hours: DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT,
    },
  };
  if (!isUuidRestaurantId(restaurantId)) {
    return defaults;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return defaults;
  }

  const { data } = await admin
    .from("restaurant_staff_module_settings")
    .select(
      "contract_two_step_signing, profile_allow_display_pin_self_service, display_auto_clock_out_enabled, display_auto_clock_out_hours",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return {
    contractTwoStepSigning: Boolean(data?.contract_two_step_signing),
    profileAllowDisplayPinSelfService: Boolean(
      data?.profile_allow_display_pin_self_service,
    ),
    displayAutoClockOut: {
      // DB-Default ist true; fehlende Zeile / null → an
      enabled: data?.display_auto_clock_out_enabled !== false,
      hours: normalizeDisplayAutoClockOutHours(
        data?.display_auto_clock_out_hours,
      ),
    },
  };
}
