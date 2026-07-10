"use client";

import {
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useTableHorizontalScroll } from "@/lib/hooks/use-table-horizontal-scroll";
import {
  moduleTableStickyIdentityBgClassName,
  moduleTableStickyIdentityHeadBgClassName,
  moduleTableStickyIdentityHover20ClassName,
  moduleTableStickyIdentityHover60ClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

const ModuleTableHorizontalScrollContext = createContext(false);

/** iOS: horizontaler Tabellen-Scroll — nicht `touch-pan-y` / `overflow-x-hidden` mischen. */
export const moduleTableHorizontalScrollClassName =
  "overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]";

export function useModuleTableHorizontalScroll() {
  return useContext(ModuleTableHorizontalScrollContext);
}

export function ModuleTableHorizontalScrollRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, canScrollX } = useTableHorizontalScroll();

  return (
    <ModuleTableHorizontalScrollContext.Provider value={canScrollX}>
      <div
        ref={ref}
        className={cn(moduleTableHorizontalScrollClassName, className)}
      >
        {children}
      </div>
    </ModuleTableHorizontalScrollContext.Provider>
  );
}

const moduleTableStickyColumnShadowClassName =
  "shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]";

/** Sticky Identitätsspalte im Tabellenkopf — nur bei horizontalem Scroll. */
export function moduleTableStickyHeadCellClassName(
  active: boolean,
  className?: string,
) {
  return cn(
    active &&
      cn(
        "sticky left-0 top-0 z-[11]",
        moduleTableStickyIdentityHeadBgClassName,
        moduleTableStickyColumnShadowClassName,
      ),
    className,
  );
}

type StickyBodyTone = "card" | "muted-hover-20" | "muted-hover-60";

/** Sticky Identitätsspalte in Tabellenzeilen — nur bei horizontalem Scroll. */
export function moduleTableStickyBodyCellClassName(
  active: boolean,
  {
    tone = "card",
    className,
  }: { tone?: StickyBodyTone; className?: string } = {},
) {
  return cn(
    active &&
      cn(
        "sticky left-0 z-[1]",
        moduleTableStickyIdentityBgClassName,
        moduleTableStickyColumnShadowClassName,
        tone === "muted-hover-20" && moduleTableStickyIdentityHover20ClassName,
        tone === "muted-hover-60" && moduleTableStickyIdentityHover60ClassName,
      ),
    className,
  );
}

export function ModuleTableStickyBodyCell({
  className,
  tone = "card",
  ...props
}: ComponentPropsWithoutRef<"td"> & { tone?: StickyBodyTone }) {
  const canScrollX = useModuleTableHorizontalScroll();

  return (
    <td
      className={moduleTableStickyBodyCellClassName(canScrollX, {
        tone,
        className,
      })}
      {...props}
    />
  );
}
