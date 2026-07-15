"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  OrderProtocolActor,
  PurchaseOrder,
  PurchaseOrderLine,
} from "@/lib/types/purchase-order";
import {
  inventoryCompactQtyUnitSuffixClassName,
  inventoryTouchOrderQtyInputCn,
} from "@/lib/ui/inventory-touch-qty-input";
import { cn } from "@/lib/utils";

function PurchaseOrderCompactLineQtyInput({
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

  if (readOnly) {
    return (
      <p className="text-right text-sm font-semibold tabular-nums text-foreground">
        {line.quantity}{" "}
        <span className="text-xs font-normal text-muted-foreground">{unitLabel}</span>
      </p>
    );
  }

  return (
    <div className="relative justify-self-end">
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
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={inventoryTouchOrderQtyInputCn(line.quantity > 0, "compact")}
        aria-label={`Menge ${line.ingredientName}`}
      />
      <span className={inventoryCompactQtyUnitSuffixClassName}>{unitLabel}</span>
    </div>
  );
}

export type PurchaseOrderCompactLinesListProps = {
  order: PurchaseOrder;
  lines: PurchaseOrderLine[];
  actor: OrderProtocolActor;
  onCommitQty: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => Promise<boolean>;
  unitLabelForLine: (line: PurchaseOrderLine) => string;
  onMarkDelivered: (orderId: string, lineId: string) => void;
  onUnmarkDelivered: (orderId: string, lineId: string) => void;
};

/** Kompakt: Zutatenname (voll lesbar) + Mengenfeld — für schnelle Bestellbearbeitung. */
export function PurchaseOrderCompactLinesList({
  order,
  lines,
  actor,
  onCommitQty,
  unitLabelForLine,
  onMarkDelivered,
  onUnmarkDelivered,
}: PurchaseOrderCompactLinesListProps) {
  const readOnly = order.status !== "open";

  if (lines.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Noch keine Positionen.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
      <div
        className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2 border-b border-border/50 bg-muted/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        aria-hidden
      >
        <span>Zutat</span>
        <span className="text-center">Menge</span>
      </div>
      <ul className="divide-y divide-border/40">
        {lines.map((line) => {
          const unitLabel = unitLabelForLine(line);
          return (
            <li
              key={line.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-2 px-3 py-1.5",
                line.deliveredAt && "bg-emerald-500/5",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug break-words text-foreground">
                  {line.ingredientName}
                </p>
                {order.status === "closed" ? (
                  line.deliveredAt ? (
                    <button
                      type="button"
                      className="mt-0.5 text-left text-[11px] font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                      onClick={() => onUnmarkDelivered(order.id, line.id)}
                    >
                      Geliefert · rückgängig
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mt-0.5 text-left text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => onMarkDelivered(order.id, line.id)}
                    >
                      Als geliefert markieren
                    </button>
                  )
                ) : null}
              </div>
              <PurchaseOrderCompactLineQtyInput
                orderId={order.id}
                line={line}
                readOnly={readOnly}
                actor={actor}
                onCommit={onCommitQty}
                unitLabel={unitLabel}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
