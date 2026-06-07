"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { SlidingTabHighlight } from "@/components/embed/sliding-tab-highlight";
import { useSlidingTabHighlight } from "@/components/embed/use-sliding-tab-highlight";
import { Button } from "@/components/ui/button";
import { usePointerFine } from "@/hooks/use-pointer-fine";
import { scrollCategoryTabIntoView } from "@/lib/menu/category-tabs-scroll";
import { profileDockActiveBgClassName } from "@/lib/public-profile/profile-dock-styles";
import type { MenuCategoryDefinition } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type EmbedMenuCategoryTabsProps = {
  categories: MenuCategoryDefinition[];
  activeCategoryId: string;
  onCategorySelect: (id: string) => void;
  /** Profil-Sheet: gleitender Hover-/Aktiv-Indikator wie Dock/Reservierung. */
  variant?: "default" | "sliding";
};

function EmbedMenuCategoryTabsDefault({
  categories,
  activeCategoryId,
  onCategorySelect,
}: Omit<EmbedMenuCategoryTabsProps, "variant">) {
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

  return (
    <EmbedMenuCategoryTabsScroller
      scrollerRef={scrollerRef}
      pointerFine={pointerFine}
      hasOverflow={hasOverflow}
      canLeft={canLeft}
      canRight={canRight}
      updateScrollArrows={updateScrollArrows}
      scrollRail={scrollRail}
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
    </EmbedMenuCategoryTabsScroller>
  );
}

function EmbedMenuCategoryTabsSliding({
  categories,
  activeCategoryId,
  onCategorySelect,
}: Omit<EmbedMenuCategoryTabsProps, "variant">) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const pointerFine = usePointerFine();
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const {
    containerRef,
    tabRefs,
    highlightIndex,
    highlight,
    setHoverIndex,
    clearHover,
  } = useSlidingTabHighlight({ items: categories, value: activeCategoryId });

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
    const btn = tabRefs.current.get(activeCategoryId);
    if (!scroller || !btn) return;
    scrollCategoryTabIntoView(scroller, btn, {
      behavior: pointerFine ? "smooth" : "auto",
    });
  }, [activeCategoryId, pointerFine, tabRefs]);

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

  return (
    <EmbedMenuCategoryTabsScroller
      scrollerRef={scrollerRef}
      pointerFine={pointerFine}
      hasOverflow={hasOverflow}
      canLeft={canLeft}
      canRight={canRight}
      updateScrollArrows={updateScrollArrows}
      scrollRail={scrollRail}
      slidingTrack
    >
      <div
        ref={containerRef}
        role="tablist"
        aria-orientation="horizontal"
        aria-label="Kategorien"
        className="relative flex w-max flex-nowrap items-center gap-1.5"
        onPointerLeave={clearHover}
      >
        <SlidingTabHighlight highlight={highlight} className="rounded-full" />
        {categories.map((cat, index) => {
          const selected = activeCategoryId === cat.id;
          const isHighlighted = index === highlightIndex;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selected}
              ref={(el) => {
                if (el) tabRefs.current.set(cat.id, el);
                else tabRefs.current.delete(cat.id);
              }}
              className={cn(
                "relative z-10 inline-flex max-w-[200px] shrink-0 items-center rounded-full bg-transparent px-3 py-1.5 text-sm font-medium transition-colors",
                isHighlighted
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onCategorySelect(cat.id)}
              onPointerEnter={() => setHoverIndex(index)}
            >
              <span className="truncate">{cat.name}</span>
            </button>
          );
        })}
      </div>
    </EmbedMenuCategoryTabsScroller>
  );
}

function EmbedMenuCategoryTabsScroller({
  scrollerRef,
  pointerFine,
  hasOverflow,
  canLeft,
  canRight,
  updateScrollArrows,
  scrollRail,
  slidingTrack = false,
  children,
}: {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  pointerFine: boolean;
  hasOverflow: boolean;
  canLeft: boolean;
  canRight: boolean;
  updateScrollArrows: () => void;
  scrollRail: (dir: -1 | 1) => void;
  slidingTrack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex max-h-11 items-center gap-1 sm:gap-1.5",
        slidingTrack ? "w-fit max-w-full" : "w-full",
      )}
    >
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
        data-profile-sheet-horizontal-scroll
        onScroll={updateScrollArrows}
        className={cn(
          "min-h-10 overflow-x-auto overflow-y-hidden overscroll-x-contain",
          "touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none]",
          "[&::-webkit-scrollbar]:hidden",
          slidingTrack
            ? hasOverflow
              ? "min-w-0 w-full max-w-full"
              : "w-fit max-w-full"
            : "min-w-0 flex-1",
        )}
      >
        <div
          role={slidingTrack ? "presentation" : "tablist"}
          aria-orientation={slidingTrack ? undefined : "horizontal"}
          aria-label={slidingTrack ? undefined : "Kategorien"}
          className={cn(
            "flex h-10 w-max flex-nowrap items-center pr-1",
            !slidingTrack && "min-w-full",
            slidingTrack
              ? cn("gap-0 rounded-xl p-1", profileDockActiveBgClassName)
              : "gap-1.5",
          )}
        >
          {children}
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

export function EmbedMenuCategoryTabs({
  categories,
  activeCategoryId,
  onCategorySelect,
  variant = "default",
}: EmbedMenuCategoryTabsProps) {
  if (categories.length === 0) return null;

  if (variant === "sliding") {
    return (
      <EmbedMenuCategoryTabsSliding
        categories={categories}
        activeCategoryId={activeCategoryId}
        onCategorySelect={onCategorySelect}
      />
    );
  }

  return (
    <EmbedMenuCategoryTabsDefault
      categories={categories}
      activeCategoryId={activeCategoryId}
      onCategorySelect={onCategorySelect}
    />
  );
}
