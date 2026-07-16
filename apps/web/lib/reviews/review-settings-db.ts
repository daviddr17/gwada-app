import "server-only";

import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import {
  defaultReviewAutoReplyRules,
  mergeReviewAutoReplyRules,
  type ReviewAutoReplyRule,
} from "@/lib/reviews/review-settings-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchReviewAutoReplyRules(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<ReviewAutoReplyRule[]> {
  const { data, error } = await sb
    .from("restaurant_review_auto_reply_rules")
    .select("platform, rating, enabled, reply_template")
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("[gwada] review auto-reply rules read", error.message);
    return defaultReviewAutoReplyRules();
  }

  const stored = (data ?? [])
    .filter(
      (row): row is {
        platform: ReviewPlatform;
        rating: number;
        enabled: boolean;
        reply_template: string;
      } =>
        typeof row.platform === "string" &&
        typeof row.rating === "number" &&
        row.rating >= 1 &&
        row.rating <= 5,
    )
    .map((row) => ({
      platform: row.platform,
      rating: row.rating as 1 | 2 | 3 | 4 | 5,
      enabled: Boolean(row.enabled),
      replyTemplate: (row.reply_template as string) ?? "",
    }));

  return mergeReviewAutoReplyRules(stored);
}

export async function upsertReviewAutoReplyRules(
  sb: SupabaseClient,
  restaurantId: string,
  rules: ReviewAutoReplyRule[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = rules.map((rule) => ({
    restaurant_id: restaurantId,
    platform: rule.platform,
    rating: rule.rating,
    enabled: rule.enabled,
    reply_template: rule.replyTemplate.trim(),
  }));

  const { error } = await sb
    .from("restaurant_review_auto_reply_rules")
    .upsert(rows, { onConflict: "restaurant_id,platform,rating" });

  if (error) {
    return { ok: false, error: error.message };
  }

  // TripAdvisor u. a. ohne Reply-API: alte Auto-Antwort-Zeilen entfernen.
  const { error: cleanupError } = await sb
    .from("restaurant_review_auto_reply_rules")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("platform", "tripadvisor");

  if (cleanupError) {
    console.warn(
      "[gwada] review auto-reply tripadvisor cleanup",
      cleanupError.message,
    );
  }

  return { ok: true };
}
