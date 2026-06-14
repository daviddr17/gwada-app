import { NextResponse } from "next/server";
import { getGalleryConnectorPublicInfo } from "@/lib/gallery/connectors/registry";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const auth = await authorizeGalleryRestaurant(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const connectors = await getGalleryConnectorPublicInfo(restaurantId);
  return NextResponse.json({ connectors });
}
