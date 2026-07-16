import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantZonedDateKey,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export async function resolveRestaurantTimezoneForPos(
  restaurantId: string,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) return DEFAULT_RESTAURANT_TIMEZONE;
  return fetchRestaurantTimezoneServer(admin, restaurantId);
}

/** Shift a YMD by `deltaDays` (calendar arithmetic on date parts). */
export function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inklusiver Kalendertag-Bereich → UTC `[start, end)` in Restaurant-Zeitzone. */
export async function posRestaurantYmdRangeBounds(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
): Promise<{ startAt: string; endAt: string; timeZone: string } | null> {
  if (!isValidYmd(fromYmd) || !isValidYmd(toYmd) || fromYmd > toYmd) {
    return null;
  }
  const timeZone = await resolveRestaurantTimezoneForPos(restaurantId);
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const start = utcInstantForRestaurantLocal(fy, fm, fd, 0, 0, timeZone);
  const endYmdExclusive = shiftYmd(toYmd, 1);
  const [ey, em, ed] = endYmdExclusive.split("-").map(Number);
  const end = utcInstantForRestaurantLocal(ey, em, ed, 0, 0, timeZone);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timeZone,
  };
}

export async function posRestaurantTodayYmd(
  restaurantId: string,
): Promise<{ ymd: string; timeZone: string }> {
  const timeZone = await resolveRestaurantTimezoneForPos(restaurantId);
  return {
    ymd: restaurantZonedDateKey(new Date(), timeZone),
    timeZone,
  };
}
