import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import type { GalleryConnectorCapabilities } from "@/lib/gallery/connectors/types";

export type GalleryConnectorPublicInfo = {
  key: GalleryPlatform;
  displayName: string;
  connected: boolean;
  capabilities: GalleryConnectorCapabilities;
};
