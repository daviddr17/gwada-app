import "server-only";

import type { PlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";

/** Superadmin-Schalter aus `platform_integrations.enabled` für Feed-Connectors. */
export function isFeedConnectorEnabledBySuperadmin(
  platformKey: string,
  flags: PlatformMessagingFlags,
): boolean {
  if (platformKey === "gwada") return true;
  if (platformKey === "facebook") return flags.facebookEnabled;
  if (platformKey === "instagram") return flags.instagramEnabled;
  if (platformKey === "google_business") return flags.googleBusinessEnabled;
  if (platformKey === "tripadvisor") return flags.tripadvisorEnabled;
  if (platformKey === "whatsapp_channel" || platformKey === "whatsapp") {
    return flags.whatsappEnabled;
  }
  return false;
}

export async function resolveFeedConnectorConnected(
  platformKey: string,
  restaurantId: string,
  isConnected: (restaurantId: string) => Promise<boolean>,
  flags: PlatformMessagingFlags,
): Promise<boolean> {
  if (platformKey === "gwada") return true;
  if (!isFeedConnectorEnabledBySuperadmin(platformKey, flags)) return false;
  return isConnected(restaurantId);
}
