import "server-only";

import sharp from "sharp";

export const FEED_MEDIA_PREVIEW_MAX_WIDTH = 1280;
export const FEED_MEDIA_PREVIEW_WEBP_QUALITY = 82;
export const FEED_MEDIA_THUMB_MAX_WIDTH = 480;
export const FEED_MEDIA_THUMB_WEBP_QUALITY = 75;
export const FEED_MEDIA_BLUR_MAX_WIDTH = 16;
export const FEED_MEDIA_BLUR_WEBP_QUALITY = 20;
export const FEED_MEDIA_OUTPUT_MIME = "image/webp";

export type ProcessFeedMediaImageResult = {
  preview: Buffer;
  thumb: Buffer;
  blurDataUrl: string;
  width: number;
  height: number;
  previewSizeBytes: number;
  thumbSizeBytes: number;
};

export async function processFeedMediaImage(
  input: Buffer,
): Promise<ProcessFeedMediaImageResult> {
  const base = sharp(input, { failOn: "none" }).rotate();

  const previewResult = await base
    .clone()
    .resize(FEED_MEDIA_PREVIEW_MAX_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: FEED_MEDIA_PREVIEW_WEBP_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base
    .clone()
    .resize(FEED_MEDIA_THUMB_MAX_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: FEED_MEDIA_THUMB_WEBP_QUALITY, effort: 4 })
    .toBuffer();

  const blurBuffer = await base
    .clone()
    .resize(FEED_MEDIA_BLUR_MAX_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: FEED_MEDIA_BLUR_WEBP_QUALITY, effort: 2 })
    .toBuffer();

  const blurDataUrl = `data:${FEED_MEDIA_OUTPUT_MIME};base64,${blurBuffer.toString("base64")}`;

  return {
    preview: previewResult.data,
    thumb,
    blurDataUrl,
    width: previewResult.info.width,
    height: previewResult.info.height,
    previewSizeBytes: previewResult.data.length,
    thumbSizeBytes: thumb.length,
  };
}
