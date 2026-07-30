import { listPosOrdersInRange } from "@/lib/pos/pos-orders-list-server";
import {
  isValidYmd,
  posRestaurantTodayYmd,
  shiftYmd,
} from "@/lib/pos/pos-day-range-server";
import {
  clampListPageSize,
  parseListPageParam,
} from "@/lib/constants/list-pagination";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 90;
const STATUS_VALUES = new Set(["all", "open", "delivered", "cancelled"]);

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
  const statusRaw = url.searchParams.get("status")?.trim() ?? "all";
  const status = STATUS_VALUES.has(statusRaw)
    ? (statusRaw as "all" | "open" | "delivered" | "cancelled")
    : "all";
  const page = parseListPageParam(url.searchParams.get("page"));
  const pageSize = clampListPageSize(
    Number(url.searchParams.get("pageSize") ?? ""),
  );
  const search = url.searchParams.get("q")?.trim() || null;

  if (!isValidYmd(fromYmd) || !isValidYmd(toYmd)) {
    return posError("invalid_date_range", 400);
  }
  if (fromYmd > toYmd) {
    return posError("invalid_date_range", 400);
  }
  if (daysInclusive(fromYmd, toYmd) > MAX_RANGE_DAYS) {
    fromYmd = shiftYmd(toYmd, -(MAX_RANGE_DAYS - 1));
  }

  const result = await listPosOrdersInRange(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    fromYmd,
    toYmd,
    { status, page, pageSize, search },
  );
  return posJson({
    orders: result.items,
    from: fromYmd,
    to: toYmd,
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
  });
}
