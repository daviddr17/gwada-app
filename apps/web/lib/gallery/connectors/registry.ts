import "server-only";

import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import { facebookGalleryConnector } from "@/lib/gallery/connectors/facebook-gallery-connector";
import { googleBusinessGalleryConnector } from "@/lib/gallery/connectors/google-business-gallery-connector";
import { gwadaGalleryConnector } from "@/lib/gallery/connectors/gwada-gallery-connector";
import { instagramGalleryConnector } from "@/lib/gallery/connectors/instagram-gallery-connector";
import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { GalleryConnectorPublicInfo } from "@/lib/types/gallery-connectors";

const CONNECTORS: Record<GalleryPlatform, GalleryPlatformConnector> = {
  gwada: gwadaGalleryConnector,
  facebook: facebookGalleryConnector,
  instagram: instagramGalleryConnector,
  google_business: googleBusinessGalleryConnector,
};

export function getGalleryConnector(
  platform: GalleryPlatform,
): GalleryPlatformConnector {
  return CONNECTORS[platform];
}

export function listGalleryConnectors(): GalleryPlatformConnector[] {
  return Object.values(CONNECTORS);
}

export async function getGalleryConnectorPublicInfo(
  restaurantId: string,
): Promise<GalleryConnectorPublicInfo[]> {
  const { GALLERY_PLATFORM_LABELS } = await import("@/lib/constants/gallery-platforms");
  const platforms = Object.keys(CONNECTORS) as GalleryPlatform[];
  return Promise.all(
    platforms.map(async (key) => {
      const connector = CONNECTORS[key];
      const connected = await connector.isConnected(restaurantId);
      return {
        key,
        displayName: GALLERY_PLATFORM_LABELS[key],
        connected,
        capabilities: connector.capabilities,
      };
    }),
  );
}
