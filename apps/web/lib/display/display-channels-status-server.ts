import "server-only";

import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import {
  assertPlatformEmailEnabled,
  assertPlatformWhatsappEnabled,
} from "@/lib/integrations/platform-messaging-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export async function loadDisplayChannelConnections(restaurantId: string): Promise<{
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  whatsappConnected: boolean;
  emailConnected: boolean;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      whatsappEnabled: false,
      emailEnabled: false,
      whatsappConnected: false,
      emailConnected: false,
    };
  }

  const waPlatform = await assertPlatformWhatsappEnabled(admin);
  const emPlatform = await assertPlatformEmailEnabled(admin);

  let whatsappConnected = false;
  if (waPlatform.ok) {
    const config = await getWahaServerConfigForRestaurantAdmin(restaurantId);
    if (config) {
      const session = wahaSessionNameForRestaurant(restaurantId);
      const live = await wahaGetSession(config, session);
      whatsappConnected = live.ok && live.data?.status === "WORKING";
    }
  }

  let emailConnected = false;
  if (emPlatform.ok) {
    const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
    emailConnected = creds != null;
  }

  return {
    whatsappEnabled: waPlatform.ok,
    emailEnabled: emPlatform.ok,
    whatsappConnected,
    emailConnected,
  };
}
