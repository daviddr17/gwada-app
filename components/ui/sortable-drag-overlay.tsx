"use client";

import { createPortal } from "react-dom";
import type { SortableDragLayout } from "@/lib/hooks/use-sortable-reorder";
import { cn } from "@/lib/utils";

export function SortableDragOverlay({
  activeId,
  dragLayout,
  showGapLine,
  renderGhost,
}: {
  activeId: string | null;
  dragLayout: SortableDragLayout | null;
  showGapLine: boolean;
  renderGhost: (activeId: string) => React.ReactNode;
}) {
  if (typeof document === "undefined" || !activeId || !dragLayout) {
    return null;
  }

  const ghostLeft = dragLayout.pointerX - dragLayout.grabOffsetX;
  const ghostTop = dragLayout.pointerY - dragLayout.grabOffsetY;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden>
      {showGapLine && dragLayout.gapLine ? (
        <div
          className="absolute h-0.5 rounded-full bg-accent shadow-[0_0_10px_2px_color-mix(in_oklch,var(--accent)_50%,transparent)]"
          style={{
            top: dragLayout.gapLine.top,
            left: dragLayout.gapLine.left,
            width: dragLayout.gapLine.width,
            transform: "translateY(-50%)",
          }}
        />
      ) : null}
      <div
        className={cn(
          "absolute overflow-hidden rounded-xl border border-accent/40 bg-card/95 shadow-elevated backdrop-blur-sm",
          "ring-2 ring-accent/30",
        )}
        style={{
          left: ghostLeft,
          top: ghostTop,
          width: dragLayout.ghostWidth,
          minHeight: dragLayout.ghostHeight,
        }}
      >
        <div className="opacity-90">{renderGhost(activeId)}</div>
      </div>
    </div>,
    document.body,
  );
}
