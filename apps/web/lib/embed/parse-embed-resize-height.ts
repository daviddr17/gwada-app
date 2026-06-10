import {
  isGwadaEmbedLegacyResizeMessage,
  isGwadaEmbedResizeMessage,
} from "@/lib/embed/embed-protocol";

export function parseEmbedResizeHeight(data: unknown): number | null {
  if (isGwadaEmbedResizeMessage(data)) return data.height;
  if (isGwadaEmbedLegacyResizeMessage(data)) return data.height;
  return null;
}
