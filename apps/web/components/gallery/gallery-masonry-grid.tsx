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

/** Äußere Hülle — weiche Ecken, kein harter Clip-Rand. */
export const galleryMasonryGridShellClassName =
  "overflow-hidden rounded-xl bg-muted/20";

type Props = {
  items: UnifiedGalleryItem[];
  /** Ohne Handler: reine Bildwand ohne Klick-/Hover-Affordance. */
  onItemClick?: (item: UnifiedGalleryItem) => void;
  className?: string;
  /** Profil-Sheet: Wand bis an den Sheet-Rand. */
  edgeToEdge?: boolean;
};

const GalleryMasonryTile = memo(function GalleryMasonryTile({
  item,
  onItemClick,
}: {
  item: UnifiedGalleryItem;
  onItemClick?: (item: UnifiedGalleryItem) => void;
}) {
  const { src, thumbSrc } = galleryItemDisplayUrls(item);
  const videoSrc = item.fullUrl?.trim() || item.previewUrl;
  const interactive = typeof onItemClick === "function";
  const media = (
    <>
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
          imgClassName={
            interactive
              ? "transition duration-500 ease-out group-hover:scale-[1.015] group-hover:brightness-[1.03]"
              : undefined
          }
        />
      )}
      {interactive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      ) : null}
      <span className="sr-only" data-embed-mt>
        {item.title ?? item.caption ?? "Galeriebild"}
      </span>
    </>
  );

  const tileClassName = cn(
    feedGalleryMasonryItemClassName,
    "relative block overflow-hidden rounded-md bg-muted",
    item.isPinned && feedPinnedItemSurfaceClassName,
    interactive &&
      "group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={() => onItemClick(item)}
        className={tileClassName}
      >
        {media}
      </button>
    );
  }

  return <div className={tileClassName}>{media}</div>;
});

export function GalleryMasonryGrid({
  items,
  onItemClick,
  className,
  edgeToEdge = false,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        galleryMasonryGridShellClassName,
        edgeToEdge && "-mx-4 rounded-none sm:-mx-5",
        "p-1.5",
        className,
      )}
    >
      <div className={feedGalleryMasonryClassName}>
        {items.map((item) => (
          <GalleryMasonryTile
            key={item.id}
            item={item}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

const SKELETON_ASPECTS = [
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[5/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[4/5]",
] as const;

export function GalleryMasonryGridSkeleton({
  count = 10,
  className,
  edgeToEdge = false,
}: {
  count?: number;
  className?: string;
  edgeToEdge?: boolean;
}) {
  return (
    <div
      className={cn(
        galleryMasonryGridShellClassName,
        edgeToEdge && "-mx-4 rounded-none sm:-mx-5",
        "p-1.5",
        className,
      )}
      aria-busy="true"
      aria-label="Galerie wird geladen"
    >
      <div className={feedGalleryMasonryClassName}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              feedGalleryMasonryItemClassName,
              "skeleton-shimmer w-full rounded-md bg-muted/60",
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
