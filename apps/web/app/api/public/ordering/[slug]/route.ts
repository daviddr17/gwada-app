import { NextResponse } from "next/server";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import { restaurantHasAnyKioskTerminal } from "@/lib/ordering/guest-kiosk-device-server";
import {
  loadOnlineOrderingSettings,
  publicOrderingSettingsView,
} from "@/lib/ordering/online-ordering-settings-server";
import { fetchPublicOrderingMenu } from "@/lib/ordering/public-ordering-menu-server";
import type { GuestMenuChannel } from "@/lib/menu/item-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseChannel(raw: string | null): GuestMenuChannel | undefined {
  if (raw === "online" || raw === "kiosk" || raw === "table") return raw;
  return undefined;
}

/** Public menu + ordering settings for online / kiosk guest flows. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const channel = parseChannel(
    new URL(request.url).searchParams.get("channel"),
  );

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

  const [menuResult, hasKioskTerminal] = await Promise.all([
    fetchPublicOrderingMenu(slug, {
      channel,
      soldOutGuestDisplay: settings.soldOutGuestDisplay,
      guestLiveStockCheckEnabled: settings.guestLiveStockCheckEnabled,
    }),
    restaurantHasAnyKioskTerminal(
      restaurant.restaurantId,
      settings.kioskMollieTerminalId,
    ),
  ]);

  if (!menuResult.data) {
    return NextResponse.json(
      { error: menuResult.error ?? "not_found" },
      { status: menuResult.error === "not_found" ? 404 : 500 },
    );
  }

  const publicSettings = publicOrderingSettingsView(settings, {
    hasKioskTerminal,
  });
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
