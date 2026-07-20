import {
  isValidYmd,
  posRestaurantYmdRangeBounds,
} from "@/lib/pos/pos-day-range-server";
import { listClosedRegisterSessions } from "@/lib/pos/register-sessions-server";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 30), 1),
    500,
  );
  const fromYmd = url.searchParams.get("from")?.trim() ?? "";
  const toYmd = url.searchParams.get("to")?.trim() ?? "";

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.export",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let range:
    | { fromClosedAt?: string; toClosedAtExclusive?: string }
    | undefined;
  if (fromYmd && toYmd) {
    if (!isValidYmd(fromYmd) || !isValidYmd(toYmd) || fromYmd > toYmd) {
      return Response.json({ error: "invalid_date_range" }, { status: 400 });
    }
    const bounds = await posRestaurantYmdRangeBounds(
      auth.auth.restaurantId,
      fromYmd,
      toYmd,
    );
    if (bounds) {
      range = {
        fromClosedAt: bounds.startAt,
        toClosedAtExclusive: bounds.endAt,
      };
    }
  }

  const sessions = await listClosedRegisterSessions(
    auth.auth.restaurantId,
    limit,
    range,
  );

  return Response.json({
    data: sessions.map((s) => ({
      id: s.id,
      openedAt: s.opened_at,
      closedAt: s.closed_at,
      openingCashCents: s.opening_cash_cents,
      closingCashCents: s.closing_cash_cents,
      expectedCashCents: s.expected_cash_cents,
      cashDifferenceCents: s.cash_difference_cents,
      zNr: s.z_nr,
    })),
  });
}
