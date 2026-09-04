"use client";

import {
  purchaseOrderCloseProgressPercent,
  type PurchaseOrderCloseProgress,
} from "@/lib/inventory/purchase-order-close-progress";
import { cn } from "@/lib/utils";

export type { PurchaseOrderCloseProgress };

type PurchaseOrderCloseProgressOverlayProps = {
  open: boolean;
  progress: PurchaseOrderCloseProgress | null;
};

/** Blockiert die Bestell-Oberfläche während Abschließen — gleicher Look wie Upload-Overlay. */
export function PurchaseOrderCloseProgressOverlay({
  open,
  progress,
}: PurchaseOrderCloseProgressOverlayProps) {
  if (!open || !progress) return null;

  const percent = purchaseOrderCloseProgressPercent(progress);
  const showLines = progress.total > 1;
  const lineLabel =
    progress.total === 1
      ? "1 Position"
      : `${progress.done} / ${progress.total} Positionen`;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[220] flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-busy
      aria-live="polite"
      aria-label={
        showLines
          ? `Bestellung wird abgeschlossen, ${lineLabel}, ${percent} Prozent`
          : `Bestellung wird abgeschlossen, ${percent} Prozent`
      }
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-xl motion-reduce:backdrop-blur-sm"
        aria-hidden
      />

      <div className="relative w-[min(19rem,calc(100%-2.5rem))] overflow-hidden rounded-[1.375rem] border border-white/25 bg-background/80 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-background/70">
        <div className="px-5 pt-5 pb-4 text-center">
          <p className="text-[15px] font-semibold tracking-tight text-foreground">
            Bestellung wird abgeschlossen
          </p>
          {showLines ? (
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {lineLabel}
            </p>
          ) : null}
          <p
            className={cn(
              "tabular-nums text-muted-foreground",
              showLines ? "mt-0.5 text-[11px]" : "mt-1 text-xs",
            )}
          >
            {percent}&nbsp;%
          </p>
        </div>

        <div className="px-5 pb-5">
          <div
            className="h-1 overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
