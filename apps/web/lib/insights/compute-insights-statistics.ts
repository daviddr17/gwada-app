import type { ContactStatisticsResult } from "@/lib/contacts/compute-contact-statistics";
import type { NewsStatisticsResult } from "@/lib/news/compute-news-statistics";
import type { RestaurantUsageInsights } from "@/lib/insights/restaurant-usage-constants";
import type { PlatformInsightsBundle } from "@/lib/insights/platform-insights-types";
import type { ReservationStatsResult } from "@/lib/reservations/compute-reservation-stats";
import type { ReviewStatisticsResult } from "@/lib/reviews/compute-review-statistics";

export type InsightsStatsPeriod = 3 | 6 | 12;

export type InsightsStatisticsResult = {
  periodMonths: InsightsStatsPeriod;
  periodStart: string;
  periodEnd: string;
  reservations: {
    totalInPeriod: number;
    totalGuests: number;
    avgPartySize: number | null;
    byMonth: ReservationStatsResult["byMonth"];
    byWeekday: ReservationStatsResult["byWeekday"];
  };
  /** Nur native Gwada-Bewertungen (`gwada_reviews`) — kein Plattform-Cache. */
  reviews: {
    totalReviews: number;
    averageRating: number | null;
    byMonth: ReviewStatisticsResult["byMonth"];
    byPlatform: ReviewStatisticsResult["byPlatform"];
  };
  /** Nur Gwada-Kanal (`contact_messages.platform = gwada`). */
  messages: {
    totalMessages: number;
    inboundCount: number;
    outboundCount: number;
    byMonth: ContactStatisticsResult["byMonth"];
    byPlatform: ContactStatisticsResult["byPlatform"];
  };
  /** Nur native Gwada-News (`gwada_news_posts`) — kein News-Plattform-Cache. */
  news: {
    publishedInPeriod: number;
    engagementLikes: number;
    engagementComments: number;
    engagementViews: number;
    byMonth: NewsStatisticsResult["byMonth"];
    byPlatform: NewsStatisticsResult["byPlatform"];
  };
  usage: RestaurantUsageInsights;
  platforms: PlatformInsightsBundle;
  /** TripAdvisor-Sync-Meta für eigenen Chip (nicht in Gwada-KPIs). */
  tripadvisor: {
    connected: boolean;
    reviewCount: number;
    averageRating: number | null;
  };
};

export function computeInsightsStatistics(input: {
  periodMonths: InsightsStatsPeriod;
  periodStart: Date;
  periodEnd: Date;
  reservations: ReservationStatsResult;
  reviews: ReviewStatisticsResult;
  messages: ContactStatisticsResult;
  news: NewsStatisticsResult;
  newsEngagement: { likes: number; comments: number; views: number };
  usage: RestaurantUsageInsights;
  platforms: PlatformInsightsBundle;
  tripadvisor: InsightsStatisticsResult["tripadvisor"];
}): InsightsStatisticsResult {
  return {
    periodMonths: input.periodMonths,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    reservations: {
      totalInPeriod: input.reservations.totalInPeriod,
      totalGuests: input.reservations.totalGuests,
      avgPartySize: input.reservations.avgPartySize,
      byMonth: input.reservations.byMonth,
      byWeekday: input.reservations.byWeekday,
    },
    reviews: {
      totalReviews: input.reviews.totalReviews,
      averageRating: input.reviews.averageRating,
      byMonth: input.reviews.byMonth,
      byPlatform: input.reviews.byPlatform,
    },
    messages: {
      totalMessages: input.messages.totalMessages,
      inboundCount: input.messages.inboundCount,
      outboundCount: input.messages.outboundCount,
      byMonth: input.messages.byMonth,
      byPlatform: input.messages.byPlatform,
    },
    news: {
      publishedInPeriod: input.news.publishedInPeriod,
      engagementLikes: input.newsEngagement.likes,
      engagementComments: input.newsEngagement.comments,
      engagementViews: input.newsEngagement.views,
      byMonth: input.news.byMonth,
      byPlatform: input.news.byPlatform,
    },
    usage: input.usage,
    platforms: input.platforms,
    tripadvisor: input.tripadvisor,
  };
}
