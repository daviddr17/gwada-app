import "server-only";

import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { fetchRestaurantEmailIntegration } from "@/lib/supabase/restaurant-email-integration-db";
import { fetchRestaurantWhatsappIntegration } from "@/lib/supabase/restaurant-integrations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationChannelsInfo = {
  whatsappConnected: boolean;
  restaurantEmailConfigured: boolean;
  /** Plattform-SMTP als Fallback, wenn keine Restaurant-Mailbox. */
  platformEmailFallbackAvailable: boolean;
};

export async function loadNotificationChannelsInfo(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<NotificationChannelsInfo> {
  const [whatsappRow, emailRow, imapCreds] = await Promise.all([
    fetchRestaurantWhatsappIntegration(admin, restaurantId),
    fetchRestaurantEmailIntegration(admin, restaurantId),
    resolveRestaurantImapCredentials(admin, restaurantId),
  ]);

  const restaurantEmailConfigured =
    Boolean(imapCreds) ||
    (emailRow?.status === "custom" && Boolean(emailRow.config?.from_email));

  return {
    whatsappConnected: whatsappRow?.status === "working",
    restaurantEmailConfigured,
    platformEmailFallbackAvailable: true,
  };
}
