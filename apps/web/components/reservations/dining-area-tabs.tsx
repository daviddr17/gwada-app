"use client";

import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { usePointerFine } from "@/hooks/use-pointer-fine";
import type { DiningAreaRow } from "@/lib/supabase/dining-floor-db";
import { cn } from "@/lib/utils";

type DiningAreaTabsProps = {
  areas: DiningAreaRow[];
  activeAreaId: string | null;
  onAreaSelect: (id: string) => void;
  onNewArea: () => void;
  onEditArea: (area: DiningAreaRow) => void;
  onDeleteArea: (area: DiningAreaRow) => void;
};

export function DiningAreaTabs({
  areas,
  activeAreaId,
  onAreaSelect,
  onNewArea,
  onEditArea,
  onDeleteArea,
}: DiningAreaTabsProps) {
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
  }, [areas, updateScrollArrows]);

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
    if (!activeAreaId) return;
    const scroller = scrollerRef.current;
    const btn = tabBtnRefs.current.get(activeAreaId);
    if (!scroller || !btn) return;
    const sb = scroller.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    const delta = bb.left - sb.left - sb.width / 2 + bb.width / 2;
    if (Math.abs(delta) < 2) return;
    scroller.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeAreaId]);

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => alignActiveTabHorizontally());
    return () => cancelAnimationFrame(id);
  }, [activeAreaId, alignActiveTabHorizontally]);

  const scrollRail = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.min(el.clientWidth * 0.65, 280) * dir;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  const hexOk = (h: string) => /^#[0-9A-Fa-f]{6}$/i.test(h);

  return (
    <div className="flex max-h-11 items-center gap-1 sm:gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 rounded-full border-border/60 px-3.5 text-sm font-medium shadow-none dark:shadow-sm"
        onClick={onNewArea}
      >
        Neuer Bereich
      </Button>

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
          {areas.map((area) => {
            const selected = activeAreaId === area.id;
            const dot = hexOk(area.color_hex) ? area.color_hex : "#64748b";
            return (
              <div
                key={area.id}
                className="flex shrink-0 items-stretch gap-0 rounded-full"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`dining-area-pill-${area.id}`}
                  ref={(el) => {
                    if (el) tabBtnRefs.current.set(area.id, el);
                    else tabBtnRefs.current.delete(area.id);
                  }}
                  className={cn(
                    "inline-flex max-w-[220px] items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-accent bg-accent text-accent-foreground shadow-none dark:shadow-sm"
                      : "border-border/60 bg-card shadow-none dark:shadow-xs hover:bg-muted/80",
                  )}
                  onClick={() => onAreaSelect(area.id)}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                    style={{ backgroundColor: dot }}
                    aria-hidden
                  />
                  <span className="font-mono text-xs font-semibold tabular-nums opacity-90">
                    {area.display_number}
                  </span>
                  <span className="truncate">{area.name}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`${area.name} bearbeiten`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditArea(area);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                  aria-label={`${area.name} löschen`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteArea(area);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Trash2 className="size-3.5" />
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
    </div>
  );
}
