"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Ingredient } from "@/lib/types/inventory";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import { cn } from "@/lib/utils";

const touchStockInputClassName =
  "h-14 w-full rounded-2xl border border-input bg-background px-4 pr-16 text-center text-2xl font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

function InventoryMobileStockInput({
  ingredientId,
  currentStock,
  unitLabel,
  actor,
  onCommitStock,
}: {
  ingredientId: string;
  currentStock: number;
  unitLabel: string;
  actor: OrderProtocolActor;
  onCommitStock: (
    id: string,
    nextStock: number,
    unitLabel: string,
    actor: OrderProtocolActor,
  ) => void;
}) {
  const [draft, setDraft] = useState(() => String(currentStock));

  useEffect(() => {
    setDraft(String(currentStock));
  }, [ingredientId, currentStock]);

  const commit = useCallback(() => {
    const raw = draft.trim();
    const n = raw === "" ? NaN : Number.parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
      setDraft(String(currentStock));
      return;
    }
    if (n === currentStock) return;
    onCommitStock(ingredientId, n, unitLabel, actor);
  }, [actor, currentStock, draft, ingredientId, onCommitStock, unitLabel]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={touchStockInputClassName}
        aria-label={`Bestand ${unitLabel}`}
      />
      <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-muted-foreground">
        {unitLabel}
      </span>
    </div>
  );
}

export type InventoryMobileStockListProps = {
  rows: Ingredient[];
  unitLabelById: (unitId: string) => string;
  metaLineForRow: (row: Ingredient) => string | null;
  actor: OrderProtocolActor;
  onCommitStock: (
    id: string,
    nextStock: number,
    unitLabel: string,
    actor: OrderProtocolActor,
  ) => void;
  onOpenUsage: (row: Ingredient) => void;
  onOpenProtocol: (row: Ingredient) => void;
  onDelete: (row: Ingredient) => void;
};

/** Mobile-only: große Bestand-Felder ohne Quer-Scroll, Suche/Filter bleiben darüber. */
export function InventoryMobileStockList({
  rows,
  unitLabelById,
  metaLineForRow,
  actor,
  onCommitStock,
  onOpenUsage,
  onOpenProtocol,
  onDelete,
}: InventoryMobileStockListProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border/50 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Keine Zutaten für die aktuelle Suche oder Filter.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const unitLabel = unitLabelById(row.unit);
        const meta = metaLineForRow(row);
        const threshold = row.lowStockThreshold ?? 0;
        const low =
          Number.isFinite(row.currentStock) &&
          Number.isFinite(threshold) &&
          threshold > 0 &&
          row.currentStock <= threshold;

        return (
          <li
            key={row.id}
            className={cn(
              "rounded-2xl border border-border/50 bg-card p-4 shadow-card",
              low && "border-amber-500/40 bg-amber-500/5",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-snug">
                  {row.name}
                </p>
                {meta ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {meta}
                  </p>
                ) : null}
                {low ? (
                  <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Unter Schwelle ({threshold} {unitLabel})
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground"
                  aria-label="Speisen mit dieser Zutat"
                  onClick={() => onOpenUsage(row)}
                >
                  <UtensilsCrossed className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground"
                  aria-label={`Bestandsprotokoll ${row.name}`}
                  onClick={() => onOpenProtocol(row)}
                >
                  <ScrollText className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  aria-label="Zutat löschen"
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Bestand
            </p>
            <InventoryMobileStockInput
              ingredientId={row.id}
              currentStock={row.currentStock}
              unitLabel={unitLabel}
              actor={actor}
              onCommitStock={onCommitStock}
            />
          </li>
        );
      })}
    </ul>
  );
}
