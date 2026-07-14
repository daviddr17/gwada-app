"use client";

import { memo } from "react";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  feedGalleryMasonryClassName,
  feedGalleryMasonryItemClassName,
} from "@/lib/feed/feed-media-layout";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { cn } from "@/lib/utils";
import { FeedMediaImage } from "@/components/feed/feed-media-image";
import { FeedVideoTile } from "@/components/feed/feed-video-tile";
import { galleryItemDisplayUrls } from "@/lib/gallery/gallery-item-display-urls";

export const galleryMasonryGridShellClassName = "overflow-hidden rounded-[10px]";

type Props = {
  items: UnifiedGalleryItem[];
  onItemClick: (item: UnifiedGalleryItem) => void;
  className?: string;
};

const GalleryMasonryTile = memo(function GalleryMasonryTile({
  item,
  onItemClick,
}: {
  item: UnifiedGalleryItem;
  onItemClick: (item: UnifiedGalleryItem) => void;
}) {
  const { src, thumbSrc } = galleryItemDisplayUrls(item);
  const videoSrc = item.fullUrl?.trim() || item.previewUrl;

  return (
    <button
      type="button"
      onClick={() => onItemClick(item)}
      className={cn(
        feedGalleryMasonryItemClassName,
        "group relative block overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        item.isPinned && feedPinnedItemSurfaceClassName,
      )}
    >
      {item.mediaKind === "video" ? (
        <FeedVideoTile src={videoSrc} />
      ) : (
        <FeedMediaImage
          src={src}
          thumbSrc={thumbSrc}
          blurDataUrl={item.blurDataUrl}
          width={item.width}
          height={item.height}
          alt={item.title ?? item.caption ?? ""}
          naturalSize
          imgClassName="transition duration-300 group-hover:scale-[1.02]"
        />
      )}
      <span className="sr-only">
        {item.title ?? item.caption ?? "Galeriebild"}
      </span>
    </button>
  );
});

export function GalleryMasonryGrid({ items, onItemClick, className }: Props) {
  if (items.length === 0) return null;

  return (
    <div className={cn(galleryMasonryGridShellClassName, className)}>
      <div className={feedGalleryMasonryClassName}>
        {items.map((item) => (
          <GalleryMasonryTile key={item.id} item={item} onItemClick={onItemClick} />
        ))}
      </div>
    </div>
  );
}

const SKELETON_ASPECTS = [
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[5/4]",
  "aspect-[4/5]",
] as const;

export function GalleryMasonryGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(galleryMasonryGridShellClassName, className)}
      aria-busy="true"
      aria-label="Galerie wird geladen"
    >
      <div className={feedGalleryMasonryClassName}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              feedGalleryMasonryItemClassName,
              "skeleton-shimmer w-full rounded-none bg-muted/60",
              SKELETON_ASPECTS[i % SKELETON_ASPECTS.length],
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** @deprecated Alias — Spalten-Klassen nicht mehr für Layout genutzt. */
export const galleryMasonryGridColumnsClassName =
  "columns-2 gap-px sm:columns-3 lg:columns-4";
