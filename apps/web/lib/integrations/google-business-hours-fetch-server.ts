import "server-only";

import {
  fetchWithGoogleBusinessAuth,
  getGoogleBusinessAccessTokenForRestaurant,
  googleLocationResourceName,
} from "@/lib/integrations/google-business-access";
import {
  fromGoogleKitchenMoreHours,
  fromGoogleRegularHours,
  fromGoogleSpecialHours,
} from "@/lib/integrations/opening-hours-platform-format";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";

export type GoogleLocationHoursRemote = {
  weeklyHours: Record<Weekday, DayHours>;
  kitchenWeeklyHours: Record<Weekday, DayHours> | null;
  dateExceptions: DateHoursException[];
};

export async function fetchGoogleLocationHours(
  restaurantId: string,
): Promise<
  | { ok: true; data: GoogleLocationHoursRemote }
  | { ok: false; error: string }
> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const locationRaw = auth.config.location_name?.trim();
  if (!locationRaw) {
    return { ok: false, error: "google_location_missing" };
  }

  const locationName = googleLocationResourceName(locationRaw);
  const readMask = encodeURIComponent("regularHours,moreHours,specialHours");
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=${readMask}`;

  const res = await fetchWithGoogleBusinessAuth(restaurantId, url);
  if ("error" in res) {
    return { ok: false, error: res.error };
  }

  const payload = (await res.json().catch(() => ({}))) as {
    regularHours?: Parameters<typeof fromGoogleRegularHours>[0];
    moreHours?: Parameters<typeof fromGoogleKitchenMoreHours>[0];
    specialHours?: Parameters<typeof fromGoogleSpecialHours>[0];
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: payload.error?.message ?? `google_fetch_${res.status}`,
    };
  }

  return {
    ok: true,
    data: {
      weeklyHours: fromGoogleRegularHours(payload.regularHours),
      kitchenWeeklyHours: fromGoogleKitchenMoreHours(payload.moreHours),
      dateExceptions: fromGoogleSpecialHours(payload.specialHours),
    },
  };
}
