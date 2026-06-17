"use client";

import { EmbedNewsWidget } from "@/components/embed/embed-news-widget";
import type { PublicEmbedNews } from "@/lib/news/public-news-server";

export function RestaurantPublicProfileNews({
  news,
}: {
  news: PublicEmbedNews;
}) {
  return (
    <EmbedNewsWidget
      variant="profileSheet"
      accentHex={news.accentHex}
      viewMode={news.viewMode}
      connectedPlatforms={news.connectedPlatforms}
      items={news.items}
      showAllPlatformFilter={news.showAllPlatformFilter}
    />
  );
}
