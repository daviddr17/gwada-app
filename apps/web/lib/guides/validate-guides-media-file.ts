import {
  GUIDES_MEDIA_ALLOWED_MIME,
  GUIDES_MEDIA_MAX_BYTES,
} from "@/lib/constants/guides-media";

export function validateGuidesMediaFile(file: File): string | null {
  if (file.size <= 0) return "empty_file";
  if (file.size > GUIDES_MEDIA_MAX_BYTES) return "file_too_large";
  if (!(GUIDES_MEDIA_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return "unsupported_type";
  }
  return null;
}

export function guidesMediaKindFromMime(mime: string): "image" | "video" {
  return mime.startsWith("video/") ? "video" : "image";
}
