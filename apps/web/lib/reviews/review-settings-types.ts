import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  REVIEW_AUTO_REPLY_PLATFORMS,
  type ReviewAutoReplyPlatform,
} from "@/lib/constants/review-platforms";
import type { UnifiedReview } from "@/lib/reviews/unified-review";

export function reviewExternalId(review: Pick<UnifiedReview, "id" | "platform">): string {
  const prefix = `${review.platform}:`;
  if (review.id.startsWith(prefix)) return review.id.slice(prefix.length);
  return review.id;
}

export function reviewVisibilityKey(
  platform: ReviewPlatform,
  reviewId: string,
): { platform: ReviewPlatform; externalId: string } {
  return {
    platform,
    externalId: reviewExternalId({ id: reviewId, platform }),
  };
}

export type ReviewAutoReplyRule = {
  platform: ReviewAutoReplyPlatform;
  rating: 1 | 2 | 3 | 4 | 5;
  enabled: boolean;
  replyTemplate: string;
};

export function defaultReviewAutoReplyRules(): ReviewAutoReplyRule[] {
  const rules: ReviewAutoReplyRule[] = [];
  for (const platform of REVIEW_AUTO_REPLY_PLATFORMS) {
    for (let rating = 1; rating <= 5; rating++) {
      rules.push({
        platform,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        enabled: false,
        replyTemplate: "",
      });
    }
  }
  return rules;
}

export function mergeReviewAutoReplyRules(
  stored: Array<{
    platform: string;
    rating: 1 | 2 | 3 | 4 | 5;
    enabled: boolean;
    replyTemplate: string;
  }>,
): ReviewAutoReplyRule[] {
  const byKey = new Map<string, ReviewAutoReplyRule>();
  for (const rule of stored) {
    if (
      !(REVIEW_AUTO_REPLY_PLATFORMS as readonly string[]).includes(rule.platform)
    ) {
      continue;
    }
    byKey.set(`${rule.platform}:${rule.rating}`, {
      platform: rule.platform as ReviewAutoReplyPlatform,
      rating: rule.rating,
      enabled: rule.enabled,
      replyTemplate: rule.replyTemplate,
    });
  }
  return defaultReviewAutoReplyRules().map((defaults) => {
    const key = `${defaults.platform}:${defaults.rating}`;
    return byKey.get(key) ?? defaults;
  });
}

export function interpolateReviewAutoReplyTemplate(
  template: string,
  ctx: {
    authorName: string | null;
    rating: number;
    restaurantName: string;
  },
): string {
  const author = ctx.authorName?.trim() || "Gast";
  return template
    .replaceAll("{authorName}", author)
    .replaceAll("{rating}", String(ctx.rating))
    .replaceAll("{restaurantName}", ctx.restaurantName);
}
