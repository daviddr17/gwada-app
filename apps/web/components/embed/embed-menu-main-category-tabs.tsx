"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { SlidingTabHighlight } from "@/components/embed/sliding-tab-highlight";
import { useSlidingTabHighlight } from "@/components/embed/use-sliding-tab-highlight";
import { Button } from "@/components/ui/button";
import { usePointerFine } from "@/hooks/use-pointer-fine";
import { scrollCategoryTabIntoView } from "@/lib/menu/category-tabs-scroll";
import { profileDockActiveBgClassName } from "@/lib/public-profile/profile-dock-styles";
import type { MenuMainCategoryDefinition } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type EmbedMenuMainCategoryTabsProps = {
  mainCategories: MenuMainCategoryDefinition[];
  activeMainCategoryId: string;
  onMainCategorySelect: (id: string) => void;
  variant?: "default" | "sliding";
};

function EmbedMenuMainCategoryTabsDefault({
  mainCategories,
  activeMainCategoryId,
  onMainCategorySelect,
}: Omit<EmbedMenuMainCategoryTabsProps, "variant">) {
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

  const alignActiveTabHorizontally = React.useCallback(() => {
    const scroller = scrollerRef.current;
    const btn = tabBtnRefs.current.get(activeMainCategoryId);
    if (!scroller || !btn) return;
    scrollCategoryTabIntoView(scroller, btn, {
      behavior: pointerFine ? "smooth" : "auto",
    });
  }, [activeMainCategoryId, pointerFine]);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => alignActiveTabHorizontally());
    return () => cancelAnimationFrame(id);
  }, [activeMainCategoryId, alignActiveTabHorizontally]);

  const scrollRail = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.65, 280) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <EmbedMenuMainCategoryTabsScroller
      scrollerRef={scrollerRef}
      pointerFine={pointerFine}
      hasOverflow={hasOverflow}
      canLeft={canLeft}
      canRight={canRight}
      updateScrollArrows={updateScrollArrows}
      scrollRail={scrollRail}
    >
      {mainCategories.map((cat) => {
        const selected = activeMainCategoryId === cat.id;
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
                ? cn(
                    "border-border/60 text-foreground shadow-none dark:shadow-sm",
                    profileDockActiveBgClassName,
                  )
                : "border-border/60 bg-card text-muted-foreground shadow-none dark:shadow-xs hover:bg-muted/80 hover:text-foreground",
            )}
            onClick={() => onMainCategorySelect(cat.id)}
          >
            <span className="truncate">{cat.name}</span>
          </button>
        );
      })}
    </EmbedMenuMainCategoryTabsScroller>
  );
}

function EmbedMenuMainCategoryTabsSliding({
  mainCategories,
  activeMainCategoryId,
  onMainCategorySelect,
}: Omit<EmbedMenuMainCategoryTabsProps, "variant">) {
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
  } = useSlidingTabHighlight({
    items: mainCategories,
    value: activeMainCategoryId,
  });

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

  const alignActiveTabHorizontally = React.useCallback(() => {
    const scroller = scrollerRef.current;
    const btn = tabRefs.current.get(activeMainCategoryId);
    if (!scroller || !btn) return;
    scrollCategoryTabIntoView(scroller, btn, {
      behavior: pointerFine ? "smooth" : "auto",
    });
  }, [activeMainCategoryId, pointerFine, tabRefs]);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => alignActiveTabHorizontally());
    return () => cancelAnimationFrame(id);
  }, [activeMainCategoryId, alignActiveTabHorizontally]);

  const scrollRail = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.65, 280) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <EmbedMenuMainCategoryTabsScroller
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
        aria-label="Hauptkategorien"
        className="relative flex w-max flex-nowrap items-center gap-1.5"
        onPointerLeave={clearHover}
      >
        <SlidingTabHighlight highlight={highlight} className="rounded-full" />
        {mainCategories.map((cat, index) => {
          const selected = activeMainCategoryId === cat.id;
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
              onClick={() => onMainCategorySelect(cat.id)}
              onPointerEnter={() => setHoverIndex(index)}
            >
              <span className="truncate">{cat.name}</span>
            </button>
          );
        })}
      </div>
    </EmbedMenuMainCategoryTabsScroller>
  );
}

function EmbedMenuMainCategoryTabsScroller({
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
          aria-label={slidingTrack ? undefined : "Hauptkategorien"}
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

export function EmbedMenuMainCategoryTabs({
  mainCategories,
  activeMainCategoryId,
  onMainCategorySelect,
  variant = "default",
}: EmbedMenuMainCategoryTabsProps) {
  if (mainCategories.length <= 1) return null;

  if (variant === "sliding") {
    return (
      <EmbedMenuMainCategoryTabsSliding
        mainCategories={mainCategories}
        activeMainCategoryId={activeMainCategoryId}
        onMainCategorySelect={onMainCategorySelect}
      />
    );
  }

  return (
    <EmbedMenuMainCategoryTabsDefault
      mainCategories={mainCategories}
      activeMainCategoryId={activeMainCategoryId}
      onMainCategorySelect={onMainCategorySelect}
    />
  );
}
