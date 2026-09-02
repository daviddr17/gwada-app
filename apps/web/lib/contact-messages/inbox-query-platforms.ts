import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { RestaurantChannelConnectionsPayload } from "@/lib/contact-messages/restaurant-channel-connections-types";

/**
 * Plattformen für Konversations-**Listen** aus der DB.
 * Nicht an Live-Session koppeln (WAHA kurz offline ≠ leerer Posteingang).
 * `*Connected` bleibt für Versand, Chips und Sync-Hinweise.
 */
export function inboxQueryPlatformsForChannels(
  channels: RestaurantChannelConnectionsPayload,
  platform?: ContactMessagePlatform,
): ContactMessagePlatform[] {
  if (platform) return [platform];

  const platforms: ContactMessagePlatform[] = ["gwada"];
  if (channels.whatsappEnabled) platforms.push("whatsapp");
  if (channels.emailEnabled) platforms.push("email");
  if (channels.facebookEnabled) platforms.push("facebook");
  if (channels.instagramEnabled) platforms.push("instagram");
  return platforms;
}

/** @deprecated Alias — Unified-Inbox-Server nutzt Enabled-Flags statt Connected. */
export function inboxQueryPlatformsFromConnectionFlags(params: {
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected?: boolean;
  instagramConnected?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  facebookEnabled?: boolean;
  instagramEnabled?: boolean;
}): ContactMessagePlatform[] {
  const platforms: ContactMessagePlatform[] = ["gwada"];
  const wa = params.whatsappEnabled ?? params.whatsappConnected;
  const em = params.emailEnabled ?? params.emailConnected;
  const fb = params.facebookEnabled ?? params.facebookConnected;
  const ig = params.instagramEnabled ?? params.instagramConnected;
  if (wa) platforms.push("whatsapp");
  if (em) platforms.push("email");
  if (fb) platforms.push("facebook");
  if (ig) platforms.push("instagram");
  return platforms;
}
