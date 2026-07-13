import type { ContactStatisticsResult } from "@/lib/contacts/compute-contact-statistics";
import type { NewsStatisticsResult } from "@/lib/news/compute-news-statistics";
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
  reviews: {
    totalReviews: number;
    averageRating: number | null;
    byMonth: ReviewStatisticsResult["byMonth"];
    byPlatform: ReviewStatisticsResult["byPlatform"];
  };
  messages: {
    totalMessages: number;
    inboundCount: number;
    outboundCount: number;
    byMonth: ContactStatisticsResult["byMonth"];
    byPlatform: ContactStatisticsResult["byPlatform"];
  };
  news: {
    publishedInPeriod: number;
    engagementLikes: number;
    engagementComments: number;
    engagementViews: number;
    byMonth: NewsStatisticsResult["byMonth"];
    byPlatform: NewsStatisticsResult["byPlatform"];
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
  };
}
