"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePointerFine } from "@/hooks/use-pointer-fine";
import { scrollCategoryTabIntoView } from "@/lib/menu/category-tabs-scroll";
import type { MenuCategoryDefinition } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type EmbedMenuCategoryTabsProps = {
  categories: MenuCategoryDefinition[];
  activeCategoryId: string;
  onCategorySelect: (id: string) => void;
};

export function EmbedMenuCategoryTabs({
  categories,
  activeCategoryId,
  onCategorySelect,
}: EmbedMenuCategoryTabsProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const tabBtnRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const pointerFine = usePointerFine();
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  const updateScrollArrows = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setHasOverflow(scrollWidth > clientWidth + 2);
    setCanLeft(scrollLeft > 2);
    setCanRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => updateScrollArrows());
    return () => cancelAnimationFrame(id);
  }, [categories, updateScrollArrows]);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollArrows());
    ro.observe(el);
    window.addEventListener("resize", updateScrollArrows);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScrollArrows);
    };
  }, [updateScrollArrows]);

  const alignActiveTabHorizontally = React.useCallback(() => {
    const scroller = scrollerRef.current;
    const btn = tabBtnRefs.current.get(activeCategoryId);
    if (!scroller || !btn) return;
    scrollCategoryTabIntoView(scroller, btn, {
      behavior: pointerFine ? "smooth" : "auto",
    });
  }, [activeCategoryId, pointerFine]);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => alignActiveTabHorizontally());
    return () => cancelAnimationFrame(id);
  }, [activeCategoryId, alignActiveTabHorizontally]);

  const scrollRail = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.65, 280) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (categories.length === 0) return null;

  return (
    <div className="flex max-h-11 items-center gap-1 sm:gap-1.5">
      {pointerFine && hasOverflow ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="inline-flex shrink-0 rounded-full border-border/60"
          aria-label="Nach links scrollen"
          disabled={!canLeft}
          onClick={() => scrollRail(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
      ) : null}

      <div
        ref={scrollerRef}
        onScroll={updateScrollArrows}
        className={cn(
          "min-h-10 min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain",
          "touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none]",
          "[&::-webkit-scrollbar]:hidden",
        )}
      >
        <div
          role="tablist"
          aria-orientation="horizontal"
          aria-label="Kategorien"
          className="flex h-10 w-max min-w-full flex-nowrap items-center gap-1.5 pr-1"
        >
          {categories.map((cat) => {
            const selected = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selected}
                ref={(el) => {
                  if (el) tabBtnRefs.current.set(cat.id, el);
                  else tabBtnRefs.current.delete(cat.id);
                }}
                className={cn(
                  "inline-flex max-w-[200px] shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "border-accent bg-accent text-accent-foreground shadow-none dark:shadow-sm"
                    : "border-border/60 bg-card shadow-none dark:shadow-xs hover:bg-muted/80",
                )}
                onClick={() => onCategorySelect(cat.id)}
              >
                <span className="truncate">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pointerFine && hasOverflow ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="inline-flex shrink-0 rounded-full border-border/60"
          aria-label="Nach rechts scrollen"
          disabled={!canRight}
          onClick={() => scrollRail(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
