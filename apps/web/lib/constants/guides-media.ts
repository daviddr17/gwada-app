/** Storage bucket for Anleitungen step media (images + video). */
export const GUIDES_MEDIA_BUCKET = "guides-media";

/** Max upload size per step media file (matches gallery). */
export const GUIDES_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

export const GUIDES_MEDIA_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type GuidesMediaMime = (typeof GUIDES_MEDIA_ALLOWED_MIME)[number];
