import "server-only";

import {
  assertPlatformEmailEnabled,
  assertPlatformWhatsappEnabled,
} from "@/lib/integrations/platform-messaging-guard";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export type PublicProfileContactChannels = {
  emailAvailable: boolean;
  whatsappAvailable: boolean;
};

export async function loadPublicProfileContactChannelsForRestaurant(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
): Promise<PublicProfileContactChannels> {
  const [emailPlatform, whatsappPlatform] = await Promise.all([
    assertPlatformEmailEnabled(admin),
    assertPlatformWhatsappEnabled(admin),
  ]);

  let whatsappAvailable = false;
  if (whatsappPlatform.ok) {
    const config = await getWahaServerConfigForRestaurantAdmin(restaurantId);
    if (config) {
      const session = wahaSessionNameForRestaurant(restaurantId);
      const live = await wahaGetSession(config, session);
      whatsappAvailable = live.ok && live.data?.status === "WORKING";
    }
  }

  return {
    emailAvailable: emailPlatform.ok,
    whatsappAvailable,
  };
}

export async function fetchPublicProfileContactChannels(
  slugInput: string,
): Promise<
  | { data: PublicProfileContactChannels; error: null; status: 200 }
  | { data: null; error: string; status: number }
> {
  const restaurantRes = await fetchPublicEmbedRestaurant(slugInput);
  if (restaurantRes.error || !restaurantRes.data) {
    return {
      data: null,
      error: restaurantRes.error ?? "not_found",
      status: restaurantRes.status ?? 404,
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  return {
    data: await loadPublicProfileContactChannelsForRestaurant(
      admin,
      restaurantRes.data.id,
    ),
    error: null,
    status: 200,
  };
}
