import "server-only";

import { getGoogleBusinessAccessTokenForRestaurant } from "@/lib/integrations/google-business-access";
import type { GoogleOpeningHoursSyncScope } from "@/lib/integrations/google-opening-hours-sync-scopes";
import {
  toGoogleKitchenMoreHours,
  toGoogleRegularHours,
  toGoogleSpecialHours,
} from "@/lib/integrations/opening-hours-platform-format";
import { loadOpeningHoursPayloadAdmin } from "@/lib/integrations/opening-hours-load-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DateHoursException } from "@/lib/types/restaurant";

function googleLocationResourceName(locationName: string): string {
  const trimmed = locationName.trim();
  if (trimmed.startsWith("locations/")) return trimmed;
  const match = /locations\/[^/]+/.exec(trimmed);
  return match?.[0] ?? trimmed;
}

function futureDateExceptions(
  dateExceptions: DateHoursException[],
  todayYmd: string,
): DateHoursException[] {
  return dateExceptions.filter((ex) => ex.date >= todayYmd);
}

async function patchGoogleLocationHours(
  accessToken: string,
  locationName: string,
  body: Record<string, unknown>,
  updateMask: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?updateMask=${encodeURIComponent(updateMask)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

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
  const todayYmd = new Date().toISOString().slice(0, 10);

  if (scope === "regular") {
    return patchGoogleLocationHours(
      auth.accessToken,
      locationName,
      { regularHours: toGoogleRegularHours(hoursRes.weeklyHours) },
      "regularHours",
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
      auth.accessToken,
      locationName,
      { moreHours: [kitchen] },
      "moreHours",
    );
  }

  const future = futureDateExceptions(hoursRes.dateExceptions, todayYmd);
  const specialHours = toGoogleSpecialHours(future);
  return patchGoogleLocationHours(
    auth.accessToken,
    locationName,
    { specialHours },
    "specialHours",
  );
}
