import "server-only";

import {
  fetchWithGoogleBusinessAuth,
  getGoogleBusinessAccessTokenForRestaurant,
  googleLocationResourceName,
} from "@/lib/integrations/google-business-access";
import type { GoogleOpeningHoursSyncScope } from "@/lib/integrations/google-opening-hours-sync-scopes";
import { berlinCalendarYmd, toGoogleOpenInfo } from "@/lib/opening-hours/closure";
import {
  toGoogleKitchenMoreHours,
  toGoogleRegularHours,
  toGoogleSpecialHoursForSync,
} from "@/lib/integrations/opening-hours-platform-format";
import { loadOpeningHoursPayloadAdmin } from "@/lib/integrations/opening-hours-load-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function patchGoogleLocationHours(
  restaurantId: string,
  locationName: string,
  body: Record<string, unknown>,
  updateMask: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?updateMask=${encodeURIComponent(updateMask)}`;
  const res = await fetchWithGoogleBusinessAuth(restaurantId, url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if ("error" in res) {
    return { ok: false, error: res.error };
  }

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: payload.error?.message ?? `google_hours_${res.status}`,
    };
  }

  return { ok: true };
}

export async function syncOpeningHoursToGoogleBusiness(
  restaurantId: string,
  scope: GoogleOpeningHoursSyncScope,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const hoursRes = await loadOpeningHoursPayloadAdmin(admin, restaurantId);
  if ("error" in hoursRes) {
    return { ok: false, error: hoursRes.error };
  }

  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const locationRaw = auth.config.location_name?.trim();
  if (!locationRaw) {
    return { ok: false, error: "google_location_missing" };
  }

  const locationName = googleLocationResourceName(locationRaw);
  const todayYmd = berlinCalendarYmd();

  if (scope === "regular") {
    const regularHours = toGoogleRegularHours(hoursRes.weeklyHours);
    const openInfo = toGoogleOpenInfo(hoursRes.closure, todayYmd);
    const specialHours = toGoogleSpecialHoursForSync(
      hoursRes.dateExceptions,
      hoursRes.closure,
      todayYmd,
    );
    const keepStoredRegularHours =
      regularHours.periods.length === 0 && hoursRes.closure.mode !== "open";
    const body: Record<string, unknown> = { openInfo, specialHours };
    const mask = ["openInfo", "specialHours"];
    if (!keepStoredRegularHours) {
      body.regularHours = regularHours;
      mask.unshift("regularHours");
    }
    return patchGoogleLocationHours(
      restaurantId,
      locationName,
      body,
      mask.join(","),
    );
  }

  if (scope === "kitchen") {
    if (!hoursRes.kitchenHoursEnabled) {
      return { ok: false, error: "kitchen_hours_disabled" };
    }
    const kitchen = toGoogleKitchenMoreHours(hoursRes.kitchenWeeklyHours);
    if (kitchen.periods.length === 0) {
      return { ok: false, error: "kitchen_hours_empty" };
    }
    return patchGoogleLocationHours(
      restaurantId,
      locationName,
      { moreHours: [kitchen] },
      "moreHours",
    );
  }

  const specialHours = toGoogleSpecialHoursForSync(
    hoursRes.dateExceptions,
    hoursRes.closure,
    todayYmd,
  );
  return patchGoogleLocationHours(
    restaurantId,
    locationName,
    { specialHours },
    "specialHours",
  );
}
