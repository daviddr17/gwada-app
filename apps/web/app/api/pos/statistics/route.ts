import {
  isValidYmd,
  posRestaurantTodayYmd,
  shiftYmd,
} from "@/lib/pos/pos-day-range-server";
import { loadPosStatisticsBundle } from "@/lib/pos/pos-statistics-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 90;

function daysInclusive(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.floor((b - a) / 86_400_000) + 1;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) return posError(authResult.error, authResult.status);

  const today = await posRestaurantTodayYmd(authResult.auth.restaurantId);
  let fromYmd = url.searchParams.get("from")?.trim() || today.ymd;
  let toYmd = url.searchParams.get("to")?.trim() || today.ymd;

  if (!isValidYmd(fromYmd) || !isValidYmd(toYmd) || fromYmd > toYmd) {
    return posError("invalid_date_range", 400);
  }
  if (daysInclusive(fromYmd, toYmd) > MAX_RANGE_DAYS) {
    fromYmd = shiftYmd(toYmd, -(MAX_RANGE_DAYS - 1));
  }

  const stats = await loadPosStatisticsBundle(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    fromYmd,
    toYmd,
  );

  if (!stats) return posError("invalid_date_range", 400);
  return posJson(stats);
}
