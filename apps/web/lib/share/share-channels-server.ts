import "server-only";

import {
  SHARE_CHANNEL_DEFINITIONS,
  type ShareChannelKey,
} from "@/lib/constants/share-channels";
import { getNewsConnectorPublicInfo } from "@/lib/news/connectors/registry";
import type { ShareChannelPublicInfo } from "@/lib/share/share-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";

function isPlatformEnabled(
  platform: ShareChannelPublicInfo["platform"],
  flags: Awaited<ReturnType<typeof fetchPlatformMessagingFlags>>,
): boolean {
  switch (platform) {
    case "facebook":
      return flags.facebookEnabled;
    case "instagram":
      return flags.instagramEnabled;
    case "google_business":
      return flags.googleBusinessEnabled;
    default:
      return false;
  }
}

export async function getShareChannelPublicInfo(
  restaurantId: string,
): Promise<ShareChannelPublicInfo[]> {
  const newsConnectors = await getNewsConnectorPublicInfo(restaurantId);
  const connectorByPlatform = new Map(
    newsConnectors.map((c) => [c.key, c]),
  );

  const admin = createSupabaseAdminClient();
  const flags = admin
    ? await fetchPlatformMessagingFlags(admin)
    : {
        whatsappEnabled: false,
        emailEnabled: false,
        facebookEnabled: false,
        instagramEnabled: false,
        googleBusinessEnabled: false,
        lexofficeEnabled: false,
      };

  return SHARE_CHANNEL_DEFINITIONS.map((def) => {
    const connector = connectorByPlatform.get(def.platform);
    const platformEnabled = isPlatformEnabled(def.platform, flags);
    const connected = Boolean(connector?.connected && platformEnabled);
    const capabilityOk =
      def.kind === "story"
        ? connector?.capabilities.canPublishStory
        : connector?.capabilities.canCreatePost;

    return {
      key: def.key,
      label: def.label,
      platform: def.platform,
      kind: def.kind,
      connected: connected && Boolean(capabilityOk),
      platformEnabled,
      requiresImage: def.requiresImage,
    };
  });
}

export function parseShareChannelKeys(raw: unknown): ShareChannelKey[] {
  if (!Array.isArray(raw)) return [];
  const keys: ShareChannelKey[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const def = SHARE_CHANNEL_DEFINITIONS.find((d) => d.key === item);
    if (def) keys.push(def.key);
  }
  return keys;
}
