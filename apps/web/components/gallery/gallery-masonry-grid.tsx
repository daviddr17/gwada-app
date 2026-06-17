"use client";

import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

/** Galerie-Fotowand ohne Karten-Rahmen — 1 px Abstand über Spalten-Gap. */
export const galleryMasonryGridColumnsClassName =
  "columns-2 gap-px sm:columns-3 lg:columns-4";

type Props = {
  items: UnifiedGalleryItem[];
  onItemClick: (item: UnifiedGalleryItem) => void;
  className?: string;
};

export function GalleryMasonryGrid({ items, onItemClick, className }: Props) {
  return (
    <div className={cn(galleryMasonryGridColumnsClassName, className)}>
      {items.map((item) => (
        <div key={item.id} className="mb-px break-inside-avoid">
          <button
            type="button"
            onClick={() => onItemClick(item)}
            className="group relative block w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {item.mediaKind === "video" ? (
              <video
                src={item.previewUrl}
                className="block w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.previewUrl}
                alt={item.title ?? item.caption ?? ""}
                loading="lazy"
                decoding="async"
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                className="block w-full transition duration-300 group-hover:scale-[1.02]"
              />
            )}
            <span className="sr-only">
              {item.title ?? item.caption ?? "Galeriebild"}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

const SKELETON_ASPECTS = [
  "aspect-square",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
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
      className={cn(
        galleryMasonryGridColumnsClassName,
        "max-h-[min(28rem,52vh)] overflow-hidden",
        className,
      )}
      aria-busy
      aria-label="Galerie wird geladen"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "mb-px break-inside-avoid skeleton-shimmer bg-muted",
            SKELETON_ASPECTS[i % SKELETON_ASPECTS.length],
          )}
        />
      ))}
    </div>
  );
}
