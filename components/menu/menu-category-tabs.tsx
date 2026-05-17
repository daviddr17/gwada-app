"use client";

import { ChevronLeft, ChevronRight, Layers, Pencil } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePointerFine } from "@/hooks/use-pointer-fine";
import { isCategoryActive } from "@/lib/menu/item-utils";
import type { MenuCategoryDefinition } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type MenuCategoryTabsProps = {
  categories: MenuCategoryDefinition[];
  activeCategoryId: string;
  onCategorySelect: (id: string) => void;
  onNewCategory: () => void;
  onEditCategory: (cat: MenuCategoryDefinition) => void;
  /** Öffnet Drawer mit Drag & Drop, Aktiv-Regler und Bearbeiten. */
  onOpenManageCategories: () => void;
};

export function MenuCategoryTabs({
  categories,
  activeCategoryId,
  onCategorySelect,
  onNewCategory,
  onEditCategory,
  onOpenManageCategories,
}: MenuCategoryTabsProps) {
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
    const sb = scroller.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    const delta =
      bb.left - sb.left - sb.width / 2 + bb.width / 2;
    if (Math.abs(delta) < 2) return;
    scroller.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeCategoryId]);

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

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Noch keine Kategorien.
        </p>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onNewCategory}
        >
          Neue Kategorie
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-h-11 items-center gap-1 sm:gap-1.5">
      {pointerFine && hasOverflow && (
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
      )}

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
          className="flex h-10 w-max min-w-0 flex-nowrap items-center gap-1.5 pr-1"
        >
          {categories.map((cat) => {
            const selected = activeCategoryId === cat.id;
            const catLive = isCategoryActive(cat);
            return (
              <div
                key={cat.id}
                className="flex shrink-0 items-stretch gap-0 rounded-full"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`category-pill-${cat.id}`}
                  ref={(el) => {
                    if (el) tabBtnRefs.current.set(cat.id, el);
                    else tabBtnRefs.current.delete(cat.id);
                  }}
                  className={cn(
                    "inline-flex max-w-[200px] items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-accent bg-accent text-accent-foreground shadow-none dark:shadow-sm"
                      : "border-border/60 bg-card shadow-none dark:shadow-xs hover:bg-muted/80",
                    !catLive && "opacity-70",
                  )}
                  onClick={() => onCategorySelect(cat.id)}
                >
                  <span className="truncate">{cat.name}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`${cat.name} bearbeiten`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditCategory(cat);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {pointerFine && hasOverflow && (
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
      )}

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full border-border/60 shadow-none dark:shadow-sm"
        aria-label="Kategorien sortieren und verwalten"
        onClick={() => onOpenManageCategories()}
      >
        <Layers className="size-4" />
      </Button>
    </div>
  );
}
