import { NextResponse } from "next/server";
import { listWahaChannelsForRestaurant } from "@/lib/waha/waha-channels";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await listWahaChannelsForRestaurant(restaurantId, { role: "OWNER" });
  if ("error" in result) {
    return NextResponse.json({ error: result.error, channels: [] });
  }

  return NextResponse.json({ channels: result.channels });
}
