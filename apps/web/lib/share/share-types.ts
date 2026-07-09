import type { ShareChannelKey, ShareSourceType } from "@/lib/constants/share-channels";
import type { NewsPlatform } from "@/lib/constants/news-platforms";

export type ShareContentPayload = {
  title?: string | null;
  body: string;
  imageUrls?: string[];
  /** Optional link appended to caption (e.g. embed or public profile). */
  link?: string | null;
};

export type ShareChannelPublicInfo = {
  key: ShareChannelKey;
  label: string;
  platform: NewsPlatform;
  kind: "post" | "story";
  connected: boolean;
  platformEnabled: boolean;
  requiresImage: boolean;
};

export type SharePublishChannelResult =
  | { ok: true; externalUrl?: string | null }
  | { ok: false; error: string };

export type SharePublishRequestBody = {
  restaurantId: string;
  sourceType: ShareSourceType;
  title?: string | null;
  body: string;
  imageUrls?: string[];
  link?: string | null;
  channels: ShareChannelKey[];
};
