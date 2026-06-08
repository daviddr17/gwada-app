import {
  ensureRegisterSessionOpen,
  openRegisterSession,
} from "@/lib/pos/fiskaly-register-session";
import {
  authorizePosRestaurant,
  authorizePosRestaurantPermission,
} from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type OpenBody = {
  openingCashCents?: number;
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const auto = url.searchParams.get("auto") === "1";

  if (auto) {
    const auth = await authorizePosRestaurant(request, restaurantId);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const result = await ensureRegisterSessionOpen(
      auth.auth.restaurantId,
      auth.auth.userId,
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status ?? 502 });
    }
    return Response.json(result);
  }

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.manage",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: OpenBody = {};
  try {
    body = (await request.json()) as OpenBody;
  } catch {
    body = {};
  }

  if (body.openingCashCents == null || !Number.isFinite(body.openingCashCents)) {
    return Response.json({ error: "invalid_opening_cash_cents" }, { status: 400 });
  }

  const result = await openRegisterSession(auth.auth.restaurantId, {
    openingCashCents: body.openingCashCents,
    openedByProfileId: auth.auth.userId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status ?? 502 });
  }

  return Response.json(result);
}
