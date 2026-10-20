import { NextResponse } from "next/server";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import { loadOnlineOrderingSettings } from "@/lib/ordering/online-ordering-settings-server";
import { listAvailableOrderingSlots } from "@/lib/ordering/ordering-timeslots-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const fulfillment =
    new URL(request.url).searchParams.get("fulfillment")?.trim() ?? "pickup";
  if (fulfillment !== "pickup" && fulfillment !== "delivery") {
    return NextResponse.json({ error: "invalid_fulfillment" }, { status: 400 });
  }

  const restaurant = await resolveRestaurantBySlug(slug);
  if (!restaurant.ok) {
    return NextResponse.json(
      { error: restaurant.error },
      { status: restaurant.status },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 503 },
    );
  }

  const settings = await loadOnlineOrderingSettings(
    admin,
    restaurant.restaurantId,
  );
  const slots = await listAvailableOrderingSlots({
    supabase: admin,
    restaurantId: restaurant.restaurantId,
    settings,
    fulfillmentType: fulfillment,
  });

  return NextResponse.json({
    timeslotsEnabled: settings.timeslotsEnabled,
    slots,
  });
}
