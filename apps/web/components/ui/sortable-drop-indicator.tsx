"use client";

import { cn } from "@/lib/utils";
import type { SortableDropPlacement } from "@/lib/hooks/use-sortable-reorder";

/** Akzent-Linie an der Ziel-Einfügeposition (Listen / Karten). */
export function SortableDropIndicator({
  show,
  placement,
  variant = "target",
  className,
}: {
  show: boolean;
  placement: SortableDropPlacement;
  /** `origin` = frühere Position (dezent), `target` = Ablegeposition */
  variant?: "target" | "origin";
  className?: string;
}) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-2 z-20 h-0.5 rounded-full",
        placement === "before" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
        variant === "target"
          ? "bg-accent shadow-[0_0_8px_1px_color-mix(in_oklch,var(--accent)_55%,transparent)]"
          : "bg-muted-foreground/35",
        className,
      )}
    />
  );
}
