"use client";

import { Plus } from "lucide-react";
import type { UnifiedNewsStoryRing } from "@/lib/news/unified-news-story";
import { cn } from "@/lib/utils";

type Props = {
  storyRings: UnifiedNewsStoryRing[];
  onRingClick: (ring: UnifiedNewsStoryRing) => void;
  onAddRing?: () => void;
  canManage?: boolean;
};

export function NewsStoriesRow({
  storyRings,
  onRingClick,
  onAddRing,
  canManage = false,
}: Props) {
  if (storyRings.length === 0 && !canManage) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {canManage && onAddRing ? (
        <button
          type="button"
          onClick={onAddRing}
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
      {storyRings.map((ring) => (
        <button
          key={ring.id}
          type="button"
          onClick={() => onRingClick(ring)}
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
                src={ring.coverUrl}
                alt=""
                className="size-full rounded-full object-cover"
              />
            </span>
          </span>
          <span className="line-clamp-2 text-xs font-medium text-foreground">
            {ring.title}
          </span>
        </button>
      ))}
    </div>
  );
}
