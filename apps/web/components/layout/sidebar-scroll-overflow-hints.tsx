"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarScrollOverflowHintsProps = {
  canScrollUp: boolean;
  canScrollDown: boolean;
  onScrollUp: () => void;
  onScrollDown: () => void;
  className?: string;
};

const hintButtonClassName = cn(
  "pointer-events-auto absolute left-1/2 z-20 flex size-7 -translate-x-1/2 items-center justify-center",
  "rounded-full border border-border/60 bg-[color-mix(in_oklch,var(--app-chrome)_70%,var(--sidebar-accent))] text-sidebar-foreground/70",
  "shadow-[0_1px_3px_oklch(0_0_0/0.08),0_0_0_1px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
  "transition-[opacity,color,box-shadow,border-color,background-color] duration-300 ease-out",
  "hover:text-sidebar-foreground hover:border-border hover:bg-[color-mix(in_oklch,var(--app-chrome)_55%,var(--sidebar-accent))]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  "group-data-[collapsible=icon]/sidebar-wrapper:size-5",
);

/**
 * Sanfte Scroll-Affordance für die Sidebar-Modulliste:
 * Verlaufsmaske + dezenter Chevron nur bei echtem Überlauf.
 */
export function SidebarScrollOverflowHints({
  canScrollUp,
  canScrollDown,
  onScrollUp,
  onScrollDown,
  className,
}: SidebarScrollOverflowHintsProps) {
  if (!canScrollUp && !canScrollDown) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-11 transition-opacity duration-300 ease-out",
          "bg-gradient-to-b from-[color-mix(in_oklch,var(--app-chrome)_88%,var(--sidebar-foreground)_12%)] from-10% via-[color-mix(in_oklch,var(--app-chrome)_55%,transparent)] to-transparent",
          canScrollUp ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-14 transition-opacity duration-300 ease-out",
          "bg-gradient-to-t from-[color-mix(in_oklch,var(--app-chrome)_88%,var(--sidebar-foreground)_12%)] from-15% via-[color-mix(in_oklch,var(--app-chrome)_60%,transparent)] to-transparent",
          canScrollDown ? "opacity-100" : "opacity-0",
        )}
      />

      <button
        type="button"
        tabIndex={canScrollUp ? 0 : -1}
        aria-label="Weitere Module nach oben"
        onClick={onScrollUp}
        className={cn(
          hintButtonClassName,
          "top-1.5",
          canScrollUp ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronUp className="size-3.5" strokeWidth={2.4} />
      </button>

      <button
        type="button"
        tabIndex={canScrollDown ? 0 : -1}
        aria-label="Weitere Module nach unten"
        onClick={onScrollDown}
        className={cn(
          hintButtonClassName,
          "bottom-1.5",
          canScrollDown ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center",
            canScrollDown && "sidebar-scroll-hint-nudge",
          )}
        >
          <ChevronDown className="size-3.5" strokeWidth={2.4} />
        </span>
      </button>
    </div>
  );
}
