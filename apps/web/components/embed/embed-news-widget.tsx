"use client";

import { useMemo, useState } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import {
  NewsMasonryGrid,
  NewsListView,
} from "@/components/news/news-feed-views";
import { NewsPlatformFilterChips } from "@/components/news/news-platform-filter-chips";
import {
  NEWS_FILTER_ALL,
  type NewsPlatformFilter,
} from "@/lib/constants/news-platforms";
import type { PublicEmbedNews } from "@/lib/news/public-news-server";

export type EmbedNewsWidgetProps = {
  accentHex: string;
  viewMode: "grid" | "list";
  connectedPlatforms: PublicEmbedNews["connectedPlatforms"];
  items: PublicEmbedNews["items"];
  variant?: "embed" | "profileSheet";
};

export function EmbedNewsWidget({
  accentHex,
  viewMode,
  connectedPlatforms,
  items,
  variant = "embed",
}: EmbedNewsWidgetProps) {
  const [platformFilter, setPlatformFilter] = useState<NewsPlatformFilter>(NEWS_FILTER_ALL);

  const availablePlatforms = useMemo(
    () => new Set(connectedPlatforms),
    [connectedPlatforms],
  );

  const filtered = useMemo(() => {
    if (platformFilter === NEWS_FILTER_ALL) return items;
    return items.filter((item) => item.platform === platformFilter);
  }, [items, platformFilter]);

  const resizeDeps = useMemo(
    () => [
      viewMode,
      platformFilter,
      filtered.length,
      filtered.map((i) => `${i.id}:${i.body.length}:${i.media.length}`).join("|"),
    ],
    [viewMode, platformFilter, filtered],
  );

  const paddingClass =
    variant === "profileSheet" ? "px-0 py-0" : "px-4 py-5 sm:px-6";

  return (
    <EmbedAccentRoot accentHex={accentHex}>
      <EmbedResizeReporter widget="news" deps={resizeDeps} />
      <div className={paddingClass}>
        {connectedPlatforms.length > 1 ? (
          <div className="mb-4">
            <NewsPlatformFilterChips
              value={platformFilter}
              onChange={setPlatformFilter}
              availablePlatforms={availablePlatforms}
            />
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {platformFilter === NEWS_FILTER_ALL
              ? "Noch keine News veröffentlicht."
              : "Keine News für diese Plattform."}
          </p>
        ) : viewMode === "list" ? (
          <NewsListView items={filtered} />
        ) : (
          <NewsMasonryGrid items={filtered} />
        )}
      </div>
    </EmbedAccentRoot>
  );
}
