import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const REVIEW_FOCUS_QUERY = "review";
export const REVIEW_PROTOCOL_QUERY = "reviewProtocol";

export function reviewNotificationDomId(
  platform: ReviewPlatform,
  reviewId: string,
): string {
  return `review-${platform}-${reviewId}`;
}

/** Glocke / Push / Live-Verlauf: konkrete Bewertung öffnen, nicht nur Plattform-Filter. */
export function dashboardReviewNotificationHref(
  platform: ReviewPlatform,
  reviewId: string,
): string {
  const params = new URLSearchParams({ platform });
  if (platform === "gwada") {
    params.set(REVIEW_PROTOCOL_QUERY, reviewId);
  } else {
    params.set(REVIEW_FOCUS_QUERY, reviewId);
  }
  return `${APP_ROUTES.bewertungen.overview}?${params.toString()}`;
}
