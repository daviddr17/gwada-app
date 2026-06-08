import { resolveSessionDsfinvkZip } from "@/lib/pos/resolve-session-dsfinvk-export";
import { getRegisterSessionForRestaurant } from "@/lib/pos/register-sessions-server";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.export",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const session = await getRegisterSessionForRestaurant(
    auth.auth.restaurantId,
    sessionId,
  );
  if (!session?.closed_at) {
    return Response.json({ error: "session_not_found" }, { status: 404 });
  }

  const resolved = await resolveSessionDsfinvkZip({
    restaurantId: auth.auth.restaurantId,
    closedAt: session.closed_at,
    cashPointClosingId: session.cash_point_closing_id,
    businessDate: session.dsfinvk_business_date,
  });

  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 502 });
  }

  const dateStr = session.closed_at.slice(0, 10);
  return new Response(new Uint8Array(resolved.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dsfinvk-${dateStr}.zip"`,
      "X-Dsfinvk-Source": resolved.source,
    },
  });
}
