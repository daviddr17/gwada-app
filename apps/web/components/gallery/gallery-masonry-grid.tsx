"use client";

import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

type Props = {
  items: UnifiedGalleryItem[];
  onItemClick: (item: UnifiedGalleryItem) => void;
};

export function GalleryMasonryGrid({ items, onItemClick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick(item)}
          className="group relative aspect-square overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {item.mediaKind === "video" ? (
            <video
              src={item.previewUrl}
              className="size-full object-cover"
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
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          )}
          <span className="sr-only">
            {item.title ?? item.caption ?? "Galeriebild"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function GalleryMasonryGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4",
      )}
      aria-busy
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square skeleton-shimmer bg-muted" />
      ))}
    </div>
  );
}
