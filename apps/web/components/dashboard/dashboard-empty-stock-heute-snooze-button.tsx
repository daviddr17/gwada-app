"use client";

import { useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dispatchDashboardInventoryLivePatchFromCache } from "@/lib/dashboard/dispatch-dashboard-inventory-live-patch-from-cache";
import {
  addEmptyStockHeuteSnooze,
  removeEmptyStockHeuteSnooze,
} from "@/lib/inventory/empty-stock-heute-snooze-client";
import { cn } from "@/lib/utils";

/** Leeren Bestand in Heute ausblenden bis nach Auffüllung erneut 0. */
export function DashboardEmptyStockHeuteSnoozeButton({
  restaurantId,
  ingredientId,
  className,
  onSnoozed,
}: {
  restaurantId: string;
  ingredientId: string;
  className?: string;
  /** Nach optimistischem Ausblenden (Zeile verschwindet). */
  onSnoozed?: () => void;
}) {
  const [optimisticSnoozed, setOptimisticSnoozed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (optimisticSnoozed) {
    return (
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground",
          className,
        )}
        aria-label="Aus Heute ausgeblendet"
        title="Aus Heute ausgeblendet"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <EyeOff className="size-4" aria-hidden />
        )}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={busy || !restaurantId}
      className={cn(
        "size-9 shrink-0 rounded-full border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        className,
      )}
      aria-label="Aus Heute ausblenden"
      title="Aus Heute ausblenden bis wieder aufgefüllt"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy || !restaurantId) return;

        setOptimisticSnoozed(true);
        setBusy(true);
        addEmptyStockHeuteSnooze(restaurantId, ingredientId);
        dispatchDashboardInventoryLivePatchFromCache(restaurantId);
        onSnoozed?.();

        void fetch("/api/dashboard/inventory/empty-stock-heute-snooze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, ingredientId }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as {
                error?: string;
              } | null;
              throw new Error(body?.error ?? "Speichern fehlgeschlagen");
            }
          })
          .catch((err: unknown) => {
            removeEmptyStockHeuteSnooze(restaurantId, ingredientId);
            dispatchDashboardInventoryLivePatchFromCache(restaurantId);
            setOptimisticSnoozed(false);
            toast.error(
              err instanceof Error ? err.message : "Ausblenden fehlgeschlagen",
            );
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <EyeOff className="size-4" aria-hidden />
    </Button>
  );
}
