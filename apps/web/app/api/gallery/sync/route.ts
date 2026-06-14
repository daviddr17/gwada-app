import { NextResponse } from "next/server";
import { syncRestaurantGalleryPlatforms } from "@/lib/gallery/gallery-feed-sync-server";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    restaurantId?: string;
  } | null;
  const restaurantId = body?.restaurantId?.trim() ?? "";
  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.read",
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await syncRestaurantGalleryPlatforms(admin, restaurantId);
  return NextResponse.json(result);
}
