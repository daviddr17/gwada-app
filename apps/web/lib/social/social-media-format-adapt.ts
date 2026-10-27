import "server-only";

import sharp from "sharp";
import {
  SOCIAL_MEDIA_FORMATS,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";

/**
 * Crop/Adapt eines Master-Bildes (meist 1:1) auf Ziel-Format — ohne LLM.
 * Center-cover resize.
 */
export async function adaptSocialImageToFormat(
  masterJpegOrPng: Buffer,
  formatId: SocialMediaFormatId,
): Promise<Buffer> {
  const format = SOCIAL_MEDIA_FORMATS[formatId];
  return sharp(masterJpegOrPng)
    .rotate()
    .resize(format.width, format.height, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
