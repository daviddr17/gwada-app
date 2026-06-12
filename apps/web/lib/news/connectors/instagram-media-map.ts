import "server-only";

type IgMediaChild = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

export type IgMedia = {
  id?: string;
  caption?: string;
  timestamp?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data?: IgMediaChild[] };
};

export const IG_MEDIA_FIELDS_BASIC =
  "id,caption,timestamp,media_type,media_url,permalink,thumbnail_url";

export const IG_MEDIA_FIELDS_EXTENDED = `${IG_MEDIA_FIELDS_BASIC},like_count,comments_count,children{media_type,media_url,thumbnail_url}`;

export function igMediaPreviewUrl(media: IgMedia): string | null {
  const direct = media.media_url?.trim() || media.thumbnail_url?.trim();
  if (direct) return direct;

  for (const child of media.children?.data ?? []) {
    const childUrl = child.media_url?.trim() || child.thumbnail_url?.trim();
    if (childUrl) return childUrl;
  }

  return null;
}

export function igMediaKind(media: IgMedia): "image" | "video" {
  const type = (media.media_type ?? "").toUpperCase();
  if (type === "VIDEO" || type === "REELS") return "video";
  const childType = media.children?.data?.[0]?.media_type?.toUpperCase();
  if (childType === "VIDEO") return "video";
  return "image";
}

export function proxyInstagramNewsMediaUrl(
  restaurantId: string,
  url: string,
): string {
  const q = new URLSearchParams({
    restaurantId,
    platform: "instagram",
    url,
  });
  return `/api/contact-messages/meta/media?${q}`;
}
