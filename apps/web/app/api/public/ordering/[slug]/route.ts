import { NextResponse } from "next/server";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import {
  loadOnlineOrderingSettings,
  publicOrderingSettingsView,
} from "@/lib/ordering/online-ordering-settings-server";
import { fetchPublicOrderingMenu } from "@/lib/ordering/public-ordering-menu-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Public menu + ordering settings for online / kiosk guest flows. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
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

  const [menuResult, settings] = await Promise.all([
    fetchPublicOrderingMenu(slug),
    loadOnlineOrderingSettings(admin, restaurant.restaurantId),
  ]);

  if (!menuResult.data) {
    return NextResponse.json(
      { error: menuResult.error ?? "not_found" },
      { status: menuResult.error === "not_found" ? 404 : 500 },
    );
  }

  const publicSettings = publicOrderingSettingsView(settings);
  const orderingOpen =
    publicSettings.onlineEnabled || publicSettings.kioskEnabled;

  return NextResponse.json({
    restaurant: {
      id: restaurant.restaurantId,
      name: restaurant.name,
      slug: restaurant.slug,
      accentHex: menuResult.data.accentHex,
      currencyCode: menuResult.data.currencyCode,
    },
    settings: publicSettings,
    menu: {
      ...menuResult.data,
      guestOrderingEnabled: orderingOpen,
    },
  });
}
