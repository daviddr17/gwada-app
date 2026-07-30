"use client";

import { useEffect, useState } from "react";
import { Check, EqualApproximately, X } from "lucide-react";
import {
  PURCHASE_ORDER_LINE_DELIVERY_LABELS,
  resolveLineDelivery,
} from "@/lib/inventory/purchase-order-line-delivery";
import type {
  PurchaseOrderLine,
  PurchaseOrderLineDeliveryStatus,
} from "@/lib/types/purchase-order";
import { cn } from "@/lib/utils";

export type LineDeliveryCommit = {
  status: PurchaseOrderLineDeliveryStatus;
  deliveredQuantity?: number;
  note?: string;
};

type PurchaseOrderLineDeliveryControlsProps = {
  line: PurchaseOrderLine;
  disabled?: boolean;
  dense?: boolean;
  onCommit: (input: LineDeliveryCommit) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
};

const OUTCOMES: PurchaseOrderLineDeliveryStatus[] = [
  "delivered",
  "not_delivered",
  "partial",
];

function outcomeIcon(status: PurchaseOrderLineDeliveryStatus) {
  if (status === "delivered") return Check;
  if (status === "not_delivered") return X;
  return EqualApproximately;
}

/**
 * Kompakte Liefer-Antwort: drei Chips + optional Notiz / abweichende Menge.
 */
export function PurchaseOrderLineDeliveryControls({
  line,
  disabled,
  dense,
  onCommit,
  onClear,
}: PurchaseOrderLineDeliveryControlsProps) {
  const resolved = resolveLineDelivery(line);
  const active = resolved?.status ?? null;

  const [draftStatus, setDraftStatus] =
    useState<PurchaseOrderLineDeliveryStatus | null>(null);
  const [note, setNote] = useState("");
  const [partialQty, setPartialQty] = useState("");
  const [pending, setPending] = useState(false);

  const editing =
    draftStatus === "not_delivered" || draftStatus === "partial"
      ? draftStatus
      : null;

  useEffect(() => {
    if (draftStatus) return;
    setNote(resolved?.note ?? "");
    setPartialQty(
      resolved?.status === "partial"
        ? String(resolved.deliveredQuantity)
        : "",
    );
  }, [draftStatus, line.id, resolved?.note, resolved?.status, resolved?.deliveredQuantity]);

  const run = async (fn: () => void | Promise<void>) => {
    if (pending || disabled) return;
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  };

  const selectOutcome = (status: PurchaseOrderLineDeliveryStatus) => {
    if (disabled || pending) return;
    if (status === "delivered") {
      void run(async () => {
        setDraftStatus(null);
        await onCommit({ status: "delivered" });
      });
      return;
    }
    if (active === status && !draftStatus) {
      setDraftStatus(status);
      return;
    }
    setDraftStatus(status);
    if (status === "partial" && !partialQty) {
      setPartialQty("");
    }
  };

  const confirmExtras = () => {
    if (!editing) return;
    if (editing === "partial") {
      const q = Number.parseFloat(partialQty.replace(",", "."));
      if (Number.isNaN(q) || q < 0) return;
      void run(async () => {
        await onCommit({
          status: "partial",
          deliveredQuantity: q,
          note: note.trim() || undefined,
        });
        setDraftStatus(null);
      });
      return;
    }
    void run(async () => {
      await onCommit({
        status: "not_delivered",
        note: note.trim() || undefined,
      });
      setDraftStatus(null);
    });
  };

  return (
    <div className={cn("min-w-0", dense ? "space-y-1" : "space-y-1.5")}>
      <div className="flex flex-wrap items-center gap-1">
        {OUTCOMES.map((status) => {
          const Icon = outcomeIcon(status);
          const selected =
            (draftStatus ?? active) === status &&
            (status === "delivered" || draftStatus === status || active === status);
          const isActiveSelected = active === status && !draftStatus;
          return (
            <button
              key={status}
              type="button"
              disabled={disabled || pending}
              onClick={() => selectOutcome(status)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
                isActiveSelected || (draftStatus === status)
                  ? status === "delivered"
                    ? "border-emerald-600/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                    : status === "not_delivered"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-600/40 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                  : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                (disabled || pending) && "pointer-events-none opacity-50",
              )}
              aria-pressed={selected}
              title={PURCHASE_ORDER_LINE_DELIVERY_LABELS[status]}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">
                {PURCHASE_ORDER_LINE_DELIVERY_LABELS[status]}
              </span>
              <span className="sm:hidden">
                {status === "delivered"
                  ? "OK"
                  : status === "not_delivered"
                    ? "Nein"
                    : "≠"}
              </span>
            </button>
          );
        })}
        {active && onClear ? (
          <button
            type="button"
            disabled={disabled || pending}
            onClick={() =>
              void run(async () => {
                setDraftStatus(null);
                await onClear();
              })
            }
            className="ml-0.5 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Zurück
          </button>
        ) : null}
      </div>

      {editing ? (
        <div
          className={cn(
            "flex flex-wrap items-end gap-1.5 rounded-lg border border-border/50 bg-muted/30 p-1.5",
            dense && "gap-1 p-1",
          )}
        >
          {editing === "partial" ? (
            <label className="min-w-[4.5rem] flex-1 space-y-0.5">
              <span className="text-[10px] text-muted-foreground">Geliefert</span>
              <input
                type="text"
                inputMode="decimal"
                value={partialQty}
                onChange={(e) => setPartialQty(e.target.value)}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
                aria-label="Abweichend gelieferte Menge"
                autoFocus
              />
            </label>
          ) : null}
          <label className="min-w-[6rem] flex-[2] space-y-0.5">
            <span className="text-[10px] text-muted-foreground">
              Notiz <span className="opacity-70">(optional)</span>
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40"
              aria-label="Notiz zur Lieferung"
              autoFocus={editing === "not_delivered"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmExtras();
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={
              pending ||
              disabled ||
              (editing === "partial" &&
                (partialQty.trim() === "" ||
                  Number.isNaN(Number.parseFloat(partialQty.replace(",", ".")))))
            }
            onClick={confirmExtras}
            className="h-7 shrink-0 rounded-full bg-accent/20 px-3 text-[11px] font-medium text-foreground disabled:opacity-40"
          >
            OK
          </button>
        </div>
      ) : null}

      {!editing && resolved?.note ? (
        <p className="truncate text-[10px] text-muted-foreground">
          {resolved.note}
        </p>
      ) : null}
      {!editing && resolved?.status === "partial" ? (
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {resolved.deliveredQuantity} / {line.quantity} {line.unitLabel}
        </p>
      ) : null}
    </div>
  );
}
