/** Meta App Review Demo-Restaurant — kein WhatsApp/WAHA in der UI. */
export const META_REVIEW_DEMO_RESTAURANT_SLUG = "gwada-meta-review-demo";

export function isMetaReviewDemoRestaurantSlug(
  slug: string | null | undefined,
): boolean {
  return (slug ?? "").trim().toLowerCase() === META_REVIEW_DEMO_RESTAURANT_SLUG;
}

/** Platform keys that must never appear for the Meta App Review demo. */
export function isWhatsappPlatformKey(key: string | null | undefined): boolean {
  const k = (key ?? "").trim().toLowerCase();
  return k === "whatsapp" || k === "whatsapp_channel";
}

/** Drop WhatsApp / WhatsApp-channel entries when rendering Meta Review demo UI. */
export function withoutWhatsappPlatformsForMetaReview<T extends { key: string }>(
  items: readonly T[],
  restaurantSlug: string | null | undefined,
): T[] {
  if (!isMetaReviewDemoRestaurantSlug(restaurantSlug)) return [...items];
  return items.filter((item) => !isWhatsappPlatformKey(item.key));
}

export function withoutWhatsappPlatformKeysForMetaReview<T extends string>(
  keys: readonly T[],
  restaurantSlug: string | null | undefined,
): T[] {
  if (!isMetaReviewDemoRestaurantSlug(restaurantSlug)) return [...keys];
  return keys.filter((key) => !isWhatsappPlatformKey(key));
}
