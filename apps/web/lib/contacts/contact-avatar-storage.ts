export const RESTAURANT_CONTACT_AVATARS_BUCKET = "restaurant-contact-avatars";

const AVATAR_SYNC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function contactAvatarStoragePath(params: {
  restaurantId: string;
  kind: "contact" | "whatsapp";
  id: string;
  ext: "jpg" | "png" | "webp";
}): string {
  if (params.kind === "contact") {
    return `${params.restaurantId}/contacts/${params.id}.${params.ext}`;
  }
  const safeChatId = params.id.trim().replace(/[^a-zA-Z0-9@._-]/g, "_");
  return `${params.restaurantId}/whatsapp/${safeChatId}.${params.ext}`;
}

export function extFromImageContentType(contentType: string | null): "jpg" | "png" | "webp" {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

export function shouldRefreshWhatsappAvatarSync(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return true;
  const ts = Date.parse(syncedAt);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts >= AVATAR_SYNC_MIN_INTERVAL_MS;
}
