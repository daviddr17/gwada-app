"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Ingredient } from "@/lib/types/inventory";
import type {
  OrderProtocolActor,
  PurchaseOrder,
  PurchaseOrderLine,
} from "@/lib/types/purchase-order";
import {
  inventoryTouchOrderQtyInputCn,
  inventoryTouchQtyUnitSuffixClassName,
} from "@/lib/ui/inventory-touch-qty-input";
import { cn } from "@/lib/utils";

function PurchaseOrderMobileLineQtyInput({
  orderId,
  line,
  readOnly,
  actor,
  onCommit,
  unitLabel,
}: {
  orderId: string;
  line: PurchaseOrderLine;
  readOnly: boolean;
  actor: OrderProtocolActor;
  onCommit: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
  unitLabel: string;
}) {
  const [draft, setDraft] = useState(() => String(line.quantity));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(String(line.quantity));
  }, [line.id, line.quantity]);

  const commit = useCallback(async () => {
    if (readOnly) return;
    const q = Number.parseFloat(draft.replace(",", "."));
    if (Number.isNaN(q) || q < 0) {
      toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
      setDraft(String(line.quantity));
      return;
    }
    if (q === line.quantity) return;
    const ok = await onCommit(orderId, line.id, q, actor);
    if (!ok) {
      setDraft(String(line.quantity));
    }
  }, [actor, draft, line.id, line.quantity, onCommit, orderId, readOnly]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        disabled={readOnly}
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
        className={inventoryTouchOrderQtyInputCn(true)}
        aria-label={`Menge ${line.ingredientName}`}
      />
      <span className={inventoryTouchQtyUnitSuffixClassName}>
        {unitLabel}
      </span>
    </div>
  );
}

export type PurchaseOrderMobileLinesListProps = {
  order: PurchaseOrder;
  lines: PurchaseOrderLine[];
  ingredients: Ingredient[];
  actor: OrderProtocolActor;
  onCommitQty: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
  onMarkDelivered: (orderId: string, lineId: string) => void;
  onUnmarkDelivered: (orderId: string, lineId: string) => void;
  unitLabelForLine: (line: PurchaseOrderLine) => string;
};

/** Mobile: Positionen als Karten statt Horizontal-Scroll-Tabelle. */
export function PurchaseOrderMobileLinesList({
  order,
  lines,
  ingredients,
  actor,
  onCommitQty,
  onMarkDelivered,
  onUnmarkDelivered,
  unitLabelForLine,
}: PurchaseOrderMobileLinesListProps) {
  const readOnly = order.status !== "open";

  if (lines.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Noch keine Positionen.
      </p>
    );
  }

  return (
    <ul className="space-y-3 p-3">
      {lines.map((line) => {
        const ingRow = ingredients.find((i) => i.id === line.ingredientId);
        const metaParts = [
          line.brandLabel?.trim() || null,
          ingRow != null ? `Bestand ${ingRow.currentStock}` : null,
        ].filter(Boolean);

        return (
          <li
            key={line.id}
            className={cn(
              "rounded-2xl border border-border/50 bg-card p-4 shadow-card",
              line.deliveredAt && "border-emerald-500/35 bg-emerald-500/5",
            )}
          >
            <p className="truncate text-base font-semibold leading-snug">
              {line.ingredientName}
            </p>
            {metaParts.length > 0 ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {metaParts.join(" · ")}
              </p>
            ) : null}

            <div className="mt-3">
              <PurchaseOrderMobileLineQtyInput
                orderId={order.id}
                line={line}
                readOnly={readOnly}
                actor={actor}
                onCommit={onCommitQty}
                unitLabel={unitLabelForLine(line)}
              />
            </div>

            {order.status === "closed" ? (
              <div className="mt-3">
                {line.deliveredAt ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Geliefert
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-10 w-full rounded-xl border-border/60"
                      onClick={() => onUnmarkDelivered(order.id, line.id)}
                    >
                      Geliefert rückgängig
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 h-10 w-full rounded-xl border-border/60"
                    onClick={() => onMarkDelivered(order.id, line.id)}
                  >
                    Als geliefert markieren
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
