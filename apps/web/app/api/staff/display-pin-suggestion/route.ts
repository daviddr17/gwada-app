import { NextResponse } from "next/server";
import { suggestRestaurantDisplayPin } from "@/lib/staff/staff-display-pin-suggestion-server";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { pin, error } = await suggestRestaurantDisplayPin(restaurantId);
  if (error || !pin) {
    return NextResponse.json(
      { error: error ?? "no_pin_available" },
      { status: error === "server_misconfigured" ? 503 : 404 },
    );
  }

  return NextResponse.json({ pin });
}
