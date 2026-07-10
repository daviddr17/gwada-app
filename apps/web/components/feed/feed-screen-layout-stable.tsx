"use client";

import type { ReactNode } from "react";
import { FeedLayoutStableProvider } from "@/components/feed/feed-layout-stable-context";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";

export function FeedScreenLayoutStable({
  imageCount,
  children,
}: {
  imageCount: number;
  children: ReactNode;
}) {
  return (
    <FeedLayoutStableProvider itemCount={imageCount} enabled={imageCount > 0}>
      {children}
    </FeedLayoutStableProvider>
  );
}

export function countGalleryFeedImages(items: UnifiedGalleryItem[]): number {
  return items.filter((item) => item.mediaKind !== "video").length;
}

export function countNewsFeedImages(items: UnifiedNewsItem[]): number {
  return items.filter((item) => item.media[0]?.url).length;
}
