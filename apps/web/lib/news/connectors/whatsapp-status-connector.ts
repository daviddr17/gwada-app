import "server-only";

import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import { isRestaurantWhatsappStatusConnected } from "@/lib/news/connectors/whatsapp-status-stories";

const CAPABILITIES = {
  canReadFeed: false,
  canReadStories: true,
  canCreatePost: false,
  canPublishStory: true,
  canUpdatePost: false,
  canDeletePost: false,
  canReadInsights: false,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 1,
} as const;

/** WhatsApp Status (= Story), getrennt vom WhatsApp-Kanal-Beitrag. */
export const whatsappStatusNewsConnector: NewsPlatformConnector = {
  key: "whatsapp_status",
  displayName: "WhatsApp Status",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    return isRestaurantWhatsappStatusConnected(restaurantId);
  },
  async fetchFeed() {
    return { items: [] };
  },
  externalEditUrl() {
    return null;
  },
};
