import { closeRegisterSession } from "@/lib/pos/fiskaly-register-session";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type CloseBody = {
  closingCashCents?: number;
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.manage",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: CloseBody = {};
  try {
    body = (await request.json()) as CloseBody;
  } catch {
    body = {};
  }

  if (body.closingCashCents == null || !Number.isFinite(body.closingCashCents)) {
    return Response.json({ error: "invalid_closing_cash_cents" }, { status: 400 });
  }

  const result = await closeRegisterSession(auth.auth.restaurantId, {
    closingCashCents: body.closingCashCents,
    closedByProfileId: auth.auth.userId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status ?? 502 });
  }

  return Response.json(result);
}
