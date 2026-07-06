"use client";

import { ChevronLeft, ChevronRight, Layers, Pencil, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePointerFine } from "@/hooks/use-pointer-fine";
import { isMainCategoryActive } from "@/lib/menu/item-utils";
import { scrollCategoryTabIntoView } from "@/lib/menu/category-tabs-scroll";
import { getAppScrollRoot } from "@/lib/layout/app-scroll-root";
import { profileDockActiveBgClassName } from "@/lib/public-profile/profile-dock-styles";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import type { MenuMainCategoryDefinition } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type MenuMainCategoryTabsProps = {
  mainCategories: MenuMainCategoryDefinition[];
  activeMainCategoryId: string;
  onMainCategorySelect: (id: string) => void;
  onNewMainCategory: () => void;
  onEditMainCategory: (cat: MenuMainCategoryDefinition) => void;
  onOpenManageMainCategories: () => void;
};

export function MenuMainCategoryTabs({
  mainCategories,
  activeMainCategoryId,
  onMainCategorySelect,
  onNewMainCategory,
  onEditMainCategory,
  onOpenManageMainCategories,
}: MenuMainCategoryTabsProps) {
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
  }, [mainCategories, updateScrollArrows]);

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

  const snapActiveTabIntoView = React.useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      if (!scroller || mainCategories.length === 0) return;

      const firstId = mainCategories[0]!.id;
      if (activeMainCategoryId === firstId) {
        if (scroller.scrollLeft > 0) {
          scroller.scrollTo({ left: 0, behavior });
        }
        return;
      }

      const btn = tabBtnRefs.current.get(activeMainCategoryId);
      const tabWrap = btn?.parentElement;
      if (!btn || !tabWrap) return;
      scrollCategoryTabIntoView(scroller, tabWrap, { behavior });
    },
    [activeMainCategoryId, mainCategories],
  );

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() =>
      snapActiveTabIntoView(pointerFine ? "smooth" : "auto"),
    );
    return () => cancelAnimationFrame(id);
  }, [activeMainCategoryId, pointerFine, snapActiveTabIntoView]);

  React.useEffect(() => {
    const root = getAppScrollRoot();
    const target: HTMLElement | Window = root ?? window;
    let raf = 0;
    const onVerticalScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        snapActiveTabIntoView("auto");
      });
    };
    target.addEventListener("scroll", onVerticalScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("scroll", onVerticalScroll);
    };
  }, [snapActiveTabIntoView]);

  const scrollRail = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.65, 280) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (mainCategories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Noch keine Hauptkategorien.
        </p>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onNewMainCategory}
        >
          <Plus className="size-4" />
          Neue Hauptkategorie
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
          aria-label="Hauptkategorien"
          className="flex h-10 w-max min-w-full flex-nowrap items-center gap-1.5 pr-1"
        >
          {mainCategories.map((cat) => {
            const selected = activeMainCategoryId === cat.id;
            const catLive = isMainCategoryActive(cat);
            return (
              <div
                key={cat.id}
                className="flex shrink-0 items-stretch gap-0 rounded-full"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`main-category-pill-${cat.id}`}
                  ref={(el) => {
                    if (el) tabBtnRefs.current.set(cat.id, el);
                    else tabBtnRefs.current.delete(cat.id);
                  }}
                  className={cn(
                    "inline-flex max-w-[200px] items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? cn(
                          "border-border/60 text-foreground shadow-none dark:shadow-sm",
                          profileDockActiveBgClassName,
                        )
                      : "border-border/60 bg-card text-muted-foreground shadow-none dark:shadow-xs hover:bg-muted/80 hover:text-foreground",
                    !catLive && "opacity-70",
                  )}
                  onClick={() => onMainCategorySelect(cat.id)}
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
                    onEditMainCategory(cat);
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
        size="sm"
        className={moduleManageChipButtonClassName}
        aria-label="Hauptkategorien sortieren und verwalten"
        onClick={() => onOpenManageMainCategories()}
      >
        <Layers className="size-4" />
        Hauptkategorien
      </Button>
    </div>
  );
}
