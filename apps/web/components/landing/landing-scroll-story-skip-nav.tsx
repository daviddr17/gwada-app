"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LandingScrollStorySkipItem = {
  id: string;
  /** Anzeigename (Feature/Integration-Titel) */
  title: string;
  shortLabel?: string;
};

type Props = {
  items: readonly LandingScrollStorySkipItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
  /** aria-label Präfix, z. B. „Modul“ oder „Integration“ */
  itemNoun?: string;
};

/**
 * Chip-Nav + Vor/Zurück — klebt in der Sticky-Scroll-Story, damit man Items
 * überspringen kann ohne die volle Section zu scrollen.
 */
export function LandingScrollStorySkipNav({
  items,
  activeIndex,
  onSelect,
  className,
  itemNoun = "Eintrag",
}: Props) {
  const count = items.length;
  if (count <= 1) return null;

  const prevDisabled = activeIndex <= 0;
  const nextDisabled = activeIndex >= count - 1;

  return (
    <div className={cn("mt-8 space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0 rounded-full border-border/60"
          disabled={prevDisabled}
          aria-label={`Vorherige${itemNoun ? ` ${itemNoun}` : ""}`}
          onClick={() => onSelect(activeIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div
          className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={`${itemNoun}-Schnellwahl`}
        >
          {items.map((item, i) => {
            const active = i === activeIndex;
            const chip = item.shortLabel ?? item.title;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${itemNoun} ${i + 1}: ${item.title}`}
                title={item.title}
                onClick={() => onSelect(i)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-card/70 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {chip}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0 rounded-full border-border/60"
          disabled={nextDisabled}
          aria-label={`Nächste${itemNoun ? ` ${itemNoun}` : ""}`}
          onClick={() => onSelect(activeIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {activeIndex + 1} / {count}
      </p>
    </div>
  );
}
