"use client";

import { Sparkles } from "lucide-react";
import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import {
  FeedStoryRingButton,
  feedStoryRingsRowClassName,
} from "@/components/feed/feed-story-ring-button";
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
    <div className={cn("mb-4", feedStoryRingsRowClassName)}>
      {canManage && onAddHighlight ? (
        <button
          type="button"
          onClick={onAddHighlight}
          aria-label="Highlight anlegen"
          className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center"
        >
          <span
            className={cn(
              "flex size-[4.5rem] items-center justify-center rounded-full border-2 border-dashed border-accent/50 bg-accent/5",
              "transition group-hover:border-accent group-hover:bg-accent/10",
            )}
          >
            <Sparkles className="size-5 text-accent" aria-hidden />
          </span>
          <span className="line-clamp-2 text-xs font-medium text-muted-foreground group-hover:text-foreground">
            Highlight
          </span>
        </button>
      ) : null}
      {highlights.map((highlight) => (
        <FeedStoryRingButton
          key={highlight.id}
          coverUrl={highlight.coverUrl}
          title={highlight.title}
          onClick={() => onHighlightClick(highlight)}
        />
      ))}
    </div>
  );
}
