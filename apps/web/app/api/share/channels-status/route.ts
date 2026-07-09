import { NextResponse } from "next/server";
import { getShareChannelPublicInfo } from "@/lib/share/share-channels-server";
import { authorizeShareRestaurant } from "@/lib/share/route-auth";
import { isShareSourceType } from "@/lib/constants/share-channels";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const sourceTypeRaw = url.searchParams.get("sourceType")?.trim() ?? "gallery";

  if (!isShareSourceType(sourceTypeRaw)) {
    return NextResponse.json({ error: "invalid_source_type" }, { status: 400 });
  }

  const auth = await authorizeShareRestaurant(restaurantId, sourceTypeRaw);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const channels = await getShareChannelPublicInfo(restaurantId);
  return NextResponse.json({ channels });
}
