"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PurchaseOrderLineDeliveryControls,
  type LineDeliveryCommit,
} from "@/components/inventory/purchase-order-line-delivery-controls";
import { purchaseOrderAllowsDeliveryActions } from "@/lib/inventory/purchase-order-status";
import { resolveLineDelivery } from "@/lib/inventory/purchase-order-line-delivery";
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
  onSetDelivery: (
    orderId: string,
    lineId: string,
    input: LineDeliveryCommit,
  ) => void | Promise<void>;
  onClearDelivery: (orderId: string, lineId: string) => void | Promise<void>;
};

/** Kompakt: Zutat + Menge; bei Bestellt/Abgeschlossen dichte Liefer-Chips. */
export function PurchaseOrderCompactLinesList({
  order,
  lines,
  actor,
  onCommitQty,
  unitLabelForLine,
  onSetDelivery,
  onClearDelivery,
}: PurchaseOrderCompactLinesListProps) {
  const showDelivery = purchaseOrderAllowsDeliveryActions(order.status);
  const qtyReadOnly = false;

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
        className={cn(
          "grid gap-2 border-b border-border/50 bg-muted/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
          showDelivery
            ? "grid-cols-[minmax(0,1fr)_5.5rem]"
            : "grid-cols-[minmax(0,1fr)_7rem]",
        )}
        aria-hidden
      >
        <span>Zutat</span>
        <span className="text-center">Menge</span>
      </div>
      <ul className="divide-y divide-border/40">
        {lines.map((line) => {
          const unitLabel = unitLabelForLine(line);
          const resolved = resolveLineDelivery(line);
          return (
            <li
              key={line.id}
              className={cn(
                "px-3 py-1.5",
                resolved?.status === "delivered" && "bg-emerald-500/5",
                resolved?.status === "not_delivered" && "bg-destructive/5",
                resolved?.status === "partial" && "bg-amber-500/5",
              )}
            >
              <div
                className={cn(
                  "grid items-center gap-x-2",
                  showDelivery
                    ? "grid-cols-[minmax(0,1fr)_5.5rem]"
                    : "grid-cols-[minmax(0,1fr)_7rem]",
                )}
              >
                <p className="min-w-0 text-sm font-medium leading-snug break-words text-foreground">
                  {line.ingredientName}
                </p>
                <PurchaseOrderCompactLineQtyInput
                  orderId={order.id}
                  line={line}
                  readOnly={qtyReadOnly}
                  actor={actor}
                  onCommit={onCommitQty}
                  unitLabel={unitLabel}
                />
              </div>
              {showDelivery ? (
                <div className="mt-1">
                  <PurchaseOrderLineDeliveryControls
                    line={line}
                    dense
                    onCommit={(input) =>
                      void onSetDelivery(order.id, line.id, input)
                    }
                    onClear={() => void onClearDelivery(order.id, line.id)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
