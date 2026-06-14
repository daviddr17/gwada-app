"use client";

import { Plus } from "lucide-react";
import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

type Props = {
  highlights: UnifiedGalleryHighlight[];
  onHighlightClick: (highlight: UnifiedGalleryHighlight) => void;
  onAddHighlight?: () => void;
  canManage?: boolean;
};

export function GalleryHighlightsRow({
  highlights,
  onHighlightClick,
  onAddHighlight,
  canManage = false,
}: Props) {
  if (highlights.length === 0 && !canManage) return null;

  return (
    <div className="mb-4 flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {canManage && onAddHighlight ? (
        <button
          type="button"
          onClick={onAddHighlight}
          className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center"
        >
          <span
            className={cn(
              "flex size-[4.5rem] items-center justify-center rounded-full border-2 border-dashed border-accent/50 bg-accent/5",
              "transition group-hover:border-accent group-hover:bg-accent/10",
            )}
          >
            <Plus className="size-6 text-accent" aria-hidden />
          </span>
          <span className="line-clamp-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">
            Neu
          </span>
        </button>
      ) : null}
      {highlights.map((highlight) => (
        <button
          key={highlight.id}
          type="button"
          onClick={() => onHighlightClick(highlight)}
          className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center"
        >
          <span
            className={cn(
              "relative size-[4.5rem] overflow-hidden rounded-full p-0.5",
              "bg-gradient-to-tr from-accent via-accent/80 to-accent/40",
              "transition group-hover:shadow-md group-hover:ring-2 group-hover:ring-accent/30",
            )}
          >
            <span className="block size-full overflow-hidden rounded-full bg-background p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={highlight.coverUrl}
                alt=""
                className="size-full rounded-full object-cover"
              />
            </span>
          </span>
          <span className="line-clamp-2 text-xs font-medium text-foreground">
            {highlight.title}
          </span>
        </button>
      ))}
    </div>
  );
}
