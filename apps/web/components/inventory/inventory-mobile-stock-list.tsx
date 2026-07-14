"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollText, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AddPurchaseLineParams } from "@/lib/hooks/use-purchase-orders-storage";
import type { Ingredient } from "@/lib/types/inventory";
import type { OrderProtocolActor } from "@/lib/types/purchase-order";
import {
  inventoryTouchOrderQtyInputCn,
  inventoryTouchQtyUnitSuffixClassName,
  inventoryTouchStockQtyInputClassName,
} from "@/lib/ui/inventory-touch-qty-input";
import { cn } from "@/lib/utils";

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
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
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
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={inventoryTouchStockQtyInputClassName}
        aria-label={`Bestand ${unitLabel}`}
      />
      <span className={inventoryTouchQtyUnitSuffixClassName}>{unitLabel}</span>
    </div>
  );
}

function InventoryMobileOrderInput({
  ingredient,
  canOrder,
  supplierName,
  brandLabel,
  unitId,
  unitLabel,
  actor,
  openQty,
  openOrderId,
  openLineId,
  addLine,
  updateLineQuantity,
}: {
  ingredient: Ingredient;
  canOrder: boolean;
  supplierName: string;
  brandLabel: string;
  unitId: string;
  unitLabel: string;
  actor: OrderProtocolActor;
  openQty: number;
  openOrderId: string | null;
  openLineId: string | null;
  addLine: (p: AddPurchaseLineParams) => Promise<boolean>;
  updateLineQuantity: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() =>
    openLineId ? String(openQty) : "",
  );
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(openLineId ? String(openQty) : "");
  }, [openLineId, openQty]);

  const displayOrderQty = useMemo(() => {
    const t = draft.trim();
    if (t === "") return openLineId ? openQty : 0;
    const n = Number.parseFloat(t.replace(",", "."));
    return Number.isNaN(n) ? (openLineId ? openQty : 0) : n;
  }, [draft, openLineId, openQty]);

  const highlightOrderQty = canOrder && displayOrderQty > 0;

  const commit = useCallback(async () => {
    try {
      if (!canOrder) {
        toast.error(
          "Diese Zutat hat keinen Lieferanten in den Stammdaten und kann nicht bestellt werden.",
        );
        return;
      }
      const raw = draft.trim();
      let q: number;
      if (raw === "") {
        q = 0;
      } else {
        q = Number.parseFloat(raw.replace(",", "."));
        if (Number.isNaN(q) || q < 0) {
          toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
          setDraft(openLineId ? String(openQty) : "");
          return;
        }
      }
      if (q === openQty) return;
      if (!openLineId && q === 0) return;

      if (q === 0) {
        if (openOrderId && openLineId) {
          const ok = await updateLineQuantity(
            openOrderId,
            openLineId,
            0,
            actor,
          );
          if (!ok) {
            setDraft(openLineId ? String(openQty) : "");
          }
        }
        return;
      }

      if (!openLineId) {
        const ok = await addLine({
          supplierId: ingredient.supplierId,
          supplierName,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          brandLabel,
          quantity: q,
          unitId,
          unitLabel,
          actor,
        });
        if (!ok) {
          setDraft("");
        }
        return;
      }
      if (openOrderId && openLineId) {
        const ok = await updateLineQuantity(
          openOrderId,
          openLineId,
          q,
          actor,
        );
        if (!ok) {
          setDraft(String(openQty));
        }
      }
    } catch (e) {
      console.warn("[gwada] Bestellmenge speichern", e);
      toast.error("Bestellung konnte nicht gespeichert werden.");
      setDraft(openLineId ? String(openQty) : "");
    }
  }, [
    addLine,
    brandLabel,
    canOrder,
    draft,
    ingredient,
    openLineId,
    openOrderId,
    openQty,
    supplierName,
    unitId,
    unitLabel,
    updateLineQuantity,
    actor,
  ]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        disabled={!canOrder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={canOrder ? "0" : "—"}
        title={
          canOrder
            ? "Menge in der offenen Bestellung dieses Lieferanten (0 entfernt die Position)"
            : "Ohne Lieferant nicht bestellbar"
        }
        className={inventoryTouchOrderQtyInputCn(highlightOrderQty)}
        aria-label={`Bestellung ${unitLabel}`}
      />
      <span className={inventoryTouchQtyUnitSuffixClassName}>{unitLabel}</span>
    </div>
  );
}

export type InventoryMobileOrderContext = {
  canOrder: boolean;
  supplierName: string;
  brandLabel: string;
  unitId: string;
  openQty: number;
  openOrderId: string | null;
  openLineId: string | null;
};

export type InventoryMobileStockListProps = {
  rows: Ingredient[];
  unitLabelById: (unitId: string) => string;
  metaLineForRow: (row: Ingredient) => string | null;
  orderContextForRow: (row: Ingredient) => InventoryMobileOrderContext;
  actor: OrderProtocolActor;
  onCommitStock: (
    id: string,
    nextStock: number,
    unitLabel: string,
    actor: OrderProtocolActor,
  ) => void;
  addLine: (p: AddPurchaseLineParams) => Promise<boolean>;
  updateLineQuantity: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
  onEditIngredient: (row: Ingredient) => void;
  onOpenUsage: (row: Ingredient) => void;
  onOpenProtocol: (row: Ingredient) => void;
  onDelete: (row: Ingredient) => void;
};

/** Mobile-only: große Bestand-/Bestellung-Felder ohne Quer-Scroll. */
export function InventoryMobileStockList({
  rows,
  unitLabelById,
  metaLineForRow,
  orderContextForRow,
  actor,
  onCommitStock,
  addLine,
  updateLineQuantity,
  onEditIngredient,
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
        const orderCtx = orderContextForRow(row);
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
              <button
                type="button"
                className="min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
                onClick={() => onEditIngredient(row)}
                aria-label={`${row.name} bearbeiten`}
              >
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Tippen zum Bearbeiten
                </p>
              </button>
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

            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800/80 dark:text-sky-300/90">
                  Bestand
                </p>
                <InventoryMobileStockInput
                  ingredientId={row.id}
                  currentStock={row.currentStock}
                  unitLabel={unitLabel}
                  actor={actor}
                  onCommitStock={onCommitStock}
                />
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">
                  Bestellung
                </p>
                <InventoryMobileOrderInput
                  ingredient={row}
                  canOrder={orderCtx.canOrder}
                  supplierName={orderCtx.supplierName}
                  brandLabel={orderCtx.brandLabel}
                  unitId={orderCtx.unitId}
                  unitLabel={unitLabel}
                  actor={actor}
                  openQty={orderCtx.openQty}
                  openOrderId={orderCtx.openOrderId}
                  openLineId={orderCtx.openLineId}
                  addLine={addLine}
                  updateLineQuantity={updateLineQuantity}
                />
                {!orderCtx.canOrder ? (
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                    Ohne Lieferant nicht bestellbar
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
