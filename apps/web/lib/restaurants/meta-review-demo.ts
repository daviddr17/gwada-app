/** Meta App Review Demo-Restaurant — kein WhatsApp/WAHA in der UI. */
export const META_REVIEW_DEMO_RESTAURANT_SLUG = "gwada-meta-review-demo";

export function isMetaReviewDemoRestaurantSlug(
  slug: string | null | undefined,
): boolean {
  return (slug ?? "").trim().toLowerCase() === META_REVIEW_DEMO_RESTAURANT_SLUG;
}
