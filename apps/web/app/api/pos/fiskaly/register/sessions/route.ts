import { listClosedRegisterSessions } from "@/lib/pos/register-sessions-server";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 30), 1),
    100,
  );

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.export",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const sessions = await listClosedRegisterSessions(
    auth.auth.restaurantId,
    limit,
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
