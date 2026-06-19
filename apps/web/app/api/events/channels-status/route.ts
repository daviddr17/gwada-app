import { NextResponse } from "next/server";
import { getEventsConnectorPublicInfo } from "@/lib/events/connectors/registry";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeEventsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const connectors = await getEventsConnectorPublicInfo(restaurantId);
  return NextResponse.json({ connectors });
}
