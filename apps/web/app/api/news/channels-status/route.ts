import { NextResponse } from "next/server";
import { getNewsConnectorPublicInfo } from "@/lib/news/connectors/registry";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const connectors = await getNewsConnectorPublicInfo(restaurantId);
  return NextResponse.json({ connectors });
}
