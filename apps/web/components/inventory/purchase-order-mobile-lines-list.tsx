"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PurchaseOrderLineDeliveryControls,
  type LineDeliveryCommit,
} from "@/components/inventory/purchase-order-line-delivery-controls";
import { resolveLineDelivery } from "@/lib/inventory/purchase-order-line-delivery";
import { purchaseOrderAllowsDeliveryActions } from "@/lib/inventory/purchase-order-status";
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
        className={inventoryTouchOrderQtyInputCn(true, "compact")}
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
  onSetDelivery: (
    orderId: string,
    lineId: string,
    input: LineDeliveryCommit,
  ) => void | Promise<void>;
  onClearDelivery: (orderId: string, lineId: string) => void | Promise<void>;
  unitLabelForLine: (line: PurchaseOrderLine) => string;
};

/** Mobile: dichte Zeilen (kein Karten-Monster) für schnelles Durchklicken. */
export function PurchaseOrderMobileLinesList({
  order,
  lines,
  ingredients,
  actor,
  onCommitQty,
  onSetDelivery,
  onClearDelivery,
  unitLabelForLine,
}: PurchaseOrderMobileLinesListProps) {
  const showDelivery = purchaseOrderAllowsDeliveryActions(order.status);

  if (lines.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Noch keine Positionen.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/40 border-y border-border/40">
      {lines.map((line) => {
        const ingRow = ingredients.find((i) => i.id === line.ingredientId);
        const resolved = resolveLineDelivery(line);
        const metaParts = [
          line.brandLabel?.trim() || null,
          ingRow != null ? `Bestand ${ingRow.currentStock}` : null,
        ].filter(Boolean);

        return (
          <li
            key={line.id}
            className={cn(
              "px-3 py-2",
              resolved?.status === "delivered" && "bg-emerald-500/5",
              resolved?.status === "not_delivered" && "bg-destructive/5",
              resolved?.status === "partial" && "bg-amber-500/5",
            )}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-snug">
                  {line.ingredientName}
                </p>
                {metaParts.length > 0 ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {metaParts.join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="w-[6.5rem] shrink-0">
                <PurchaseOrderMobileLineQtyInput
                  orderId={order.id}
                  line={line}
                  readOnly={false}
                  actor={actor}
                  onCommit={onCommitQty}
                  unitLabel={unitLabelForLine(line)}
                />
              </div>
            </div>
            {showDelivery ? (
              <div className="mt-1.5">
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
  );
}
