"use client";

import type { LucideIcon } from "lucide-react";
import { SlidingTabHighlight } from "@/components/embed/sliding-tab-highlight";
import { useSlidingTabHighlight } from "@/components/embed/use-sliding-tab-highlight";
import { cn } from "@/lib/utils";

export type EmbedSlidingSegmentTab<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

export function EmbedSlidingSegmentTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  tabs: readonly EmbedSlidingSegmentTab<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const {
    containerRef,
    tabRefs,
    highlightIndex,
    highlight,
    setHoverIndex,
    clearHover,
  } = useSlidingTabHighlight({ items: tabs, value });

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative isolate rounded-xl bg-muted/40 p-1",
        className,
      )}
      onPointerLeave={clearHover}
    >
      <div ref={containerRef} className="relative z-[1] flex gap-2">
        <SlidingTabHighlight highlight={highlight} className="rounded-lg" />

        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const selected = value === tab.id;
          const isHighlighted = index === highlightIndex;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              onClick={() => onChange(tab.id)}
              onPointerEnter={() => setHoverIndex(index)}
              className={cn(
                "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-transparent py-2 text-sm font-medium transition-colors",
                isHighlighted
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
