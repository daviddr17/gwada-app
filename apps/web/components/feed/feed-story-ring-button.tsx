"use client";

import { cn } from "@/lib/utils";

/** Horizontal scroll — vertikales Padding, damit Hover-Scale nicht abgeschnitten wird. */
export const feedStoryRingsRowClassName =
  "flex gap-3 overflow-x-auto px-0.5 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type FeedStoryRingButtonProps = {
  coverUrl: string;
  title: string;
  onClick: () => void;
  /** Untertitel-Farbe (z. B. „Neu“-Platzhalter). */
  titleClassName?: string;
};

/** Story-/Highlight-Ring — Gradient ohne overflow-hidden am Außenring (Hover bleibt sichtbar). */
export function FeedStoryRingButton({
  coverUrl,
  title,
  onClick,
  titleClassName,
}: FeedStoryRingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 py-0.5 text-center"
    >
      <span
        className={cn(
          "relative flex size-[4.5rem] items-center justify-center rounded-full p-[2.5px]",
          "bg-gradient-to-tr from-accent via-accent/80 to-accent/40",
          "transition duration-200 ease-out will-change-transform",
          "group-hover:scale-105 group-hover:brightness-110 group-active:scale-[0.98]",
        )}
      >
        <span className="size-full overflow-hidden rounded-full bg-background p-[2px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="size-full rounded-full object-cover"
          />
        </span>
      </span>
      <span
        className={cn(
          "line-clamp-2 text-xs font-medium text-foreground",
          titleClassName,
        )}
      >
        {title}
      </span>
    </button>
  );
}
