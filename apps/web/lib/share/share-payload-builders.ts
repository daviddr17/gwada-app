import type { GwadaEmbedWidgetId } from "@/lib/embed/embed-protocol";
import { embedWidgetAbsoluteUrl } from "@/lib/embed/embed-widget-registry";
import type { ShareContentPayload } from "@/lib/share/share-types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import type { MenuItem } from "@/lib/types/menu";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

function embedLink(
  widget: GwadaEmbedWidgetId,
  slug: string,
  origin?: string,
): string | null {
  if (!slug.trim() || !origin?.trim()) return null;
  return embedWidgetAbsoluteUrl(widget, slug, origin);
}

function starsText(rating: number): string {
  const rounded = Math.round(Math.min(5, Math.max(0, rating)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

export function buildReviewSharePayload(params: {
  review: UnifiedReview;
  restaurantName: string;
  slug?: string | null;
  origin?: string;
}): ShareContentPayload {
  const { review, restaurantName, slug, origin } = params;
  const lines: string[] = [];
  if (review.authorName?.trim()) {
    lines.push(review.authorName.trim());
  }
  lines.push(`${starsText(review.rating)} (${review.rating}/5)`);
  if (review.comment?.trim()) {
    lines.push(review.comment.trim());
  }
  const link =
    embedLink("reviews", slug ?? "", origin) ??
    (review.externalUrl?.trim() || null);
  if (link) {
    lines.push(link);
  }
  return {
    title: `Bewertung bei ${restaurantName}`,
    body: lines.join("\n\n"),
    link,
  };
}

export function buildMenuItemSharePayload(params: {
  item: MenuItem;
  restaurantName: string;
  slug?: string | null;
  origin?: string;
}): ShareContentPayload {
  const { item, restaurantName, slug, origin } = params;
  const lines: string[] = [];
  if (item.description.trim()) {
    lines.push(item.description.trim());
  }
  if (item.price > 0) {
    lines.push(formatPrice(item.price));
  }
  const link = embedLink("menu", slug ?? "", origin);
  if (link) {
    lines.push(link);
  }
  const imageUrl = item.imageUrl?.trim();
  return {
    title: `${item.name} · ${restaurantName}`,
    body: lines.join("\n\n"),
    imageUrls: imageUrl ? [imageUrl] : [],
    link,
  };
}

export function buildGalleryItemSharePayload(params: {
  item: UnifiedGalleryItem;
  restaurantName: string;
  slug?: string | null;
  origin?: string;
}): ShareContentPayload {
  const { item, restaurantName, slug, origin } = params;
  const lines: string[] = [];
  const caption = item.caption?.trim();
  if (caption) {
    lines.push(caption);
  }
  const link = embedLink("gallery", slug ?? "", origin);
  if (link) {
    lines.push(link);
  }
  const imageUrl = item.fullUrl?.trim() || item.previewUrl?.trim();
  const title =
    item.title?.trim() ||
    item.categoryLabel?.trim() ||
    `Galerie · ${restaurantName}`;
  return {
    title,
    body: lines.length ? lines.join("\n\n") : `Einblicke aus ${restaurantName}`,
    imageUrls: imageUrl ? [imageUrl] : [],
    link,
  };
}
