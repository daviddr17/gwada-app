"use client";

import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

type Props = {
  highlights: UnifiedGalleryHighlight[];
  onHighlightClick: (highlight: UnifiedGalleryHighlight) => void;
};

export function GalleryHighlightsRow({ highlights, onHighlightClick }: Props) {
  if (highlights.length === 0) return null;

  return (
    <div className="mb-4 flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {highlights.map((highlight) => (
        <button
          key={highlight.id}
          type="button"
          onClick={() => onHighlightClick(highlight)}
          className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center"
        >
          <span
            className={cn(
              "relative size-[4.5rem] overflow-hidden rounded-full border-2 border-accent/40 p-0.5",
              "transition group-hover:border-accent group-hover:shadow-md",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={highlight.coverUrl}
              alt=""
              className="size-full rounded-full object-cover"
            />
          </span>
          <span className="line-clamp-2 text-xs font-medium text-foreground">
            {highlight.title}
          </span>
        </button>
      ))}
    </div>
  );
}
