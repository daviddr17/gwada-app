"use client";

import { Masonry } from "masonic";
import { useCallback } from "react";
import { FeedMediaImage } from "@/components/feed/feed-media-image";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { feedGalleryColumnCount } from "@/lib/feed/feed-media-layout";
import { useFeedMasonryColumns } from "@/lib/hooks/use-feed-masonry-columns";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { cn } from "@/lib/utils";

export const galleryMasonryGridShellClassName = "overflow-hidden rounded-[10px]";

type Props = {
  items: UnifiedGalleryItem[];
  onItemClick: (item: UnifiedGalleryItem) => void;
  className?: string;
};

function GalleryMasonryTile({
  item,
  onItemClick,
}: {
  item: UnifiedGalleryItem;
  onItemClick: (item: UnifiedGalleryItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onItemClick(item)}
      className={cn(
        "group relative block w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        item.isPinned && feedPinnedItemSurfaceClassName,
      )}
    >
      {item.mediaKind === "video" ? (
        <video
          src={item.previewUrl}
          className="block aspect-video w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <FeedMediaImage
          src={item.previewUrl}
          thumbSrc={item.thumbUrl}
          blurDataUrl={item.blurDataUrl}
          width={item.width}
          height={item.height}
          alt={item.title ?? item.caption ?? ""}
          imgClassName="transition duration-300 group-hover:scale-[1.02]"
        />
      )}
      <span className="sr-only">
        {item.title ?? item.caption ?? "Galeriebild"}
      </span>
    </button>
  );
}

export function GalleryMasonryGrid({ items, onItemClick, className }: Props) {
  const { columnCount, mounted } = useFeedMasonryColumns(feedGalleryColumnCount);

  const render = useCallback(
    ({ data }: { data: UnifiedGalleryItem }) => (
      <GalleryMasonryTile item={data} onItemClick={onItemClick} />
    ),
    [onItemClick],
  );

  if (items.length === 0) return null;

  if (!mounted) {
    return <GalleryMasonryGridSkeleton count={Math.min(items.length, 8)} className={className} />;
  }

  return (
    <div className={cn(galleryMasonryGridShellClassName, className)}>
      <Masonry
        items={items}
        columnCount={columnCount}
        columnGutter={1}
        rowGutter={1}
        itemKey={(item) => item.id}
        render={render}
      />
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
  const { columnCount, mounted } = useFeedMasonryColumns(feedGalleryColumnCount);
  const cols = mounted ? columnCount : feedGalleryColumnCount(1024);
  return (
    <div
      className={cn(galleryMasonryGridShellClassName, className)}
      aria-busy="true"
      aria-label="Galerie wird geladen"
    >
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
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
