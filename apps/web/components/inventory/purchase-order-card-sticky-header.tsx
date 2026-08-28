"use client";

import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DatePickerField } from "@/components/ui/date-picker";
import { getAppScrollRoot } from "@/lib/layout/app-scroll-root";
import { purchaseOrderStatusLabel } from "@/lib/inventory/purchase-order-status";
import type { PurchaseOrder } from "@/lib/types/purchase-order";
import { cn } from "@/lib/utils";

function usePurchaseOrderStickyCompact(enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCompact(false);
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const root = getAppScrollRoot();
    const io = new IntersectionObserver(
      ([entry]) => {
        setCompact(!entry.isIntersecting);
      },
      {
        root: root ?? null,
        threshold: 0,
        rootMargin: "-1px 0px 0px 0px",
      },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [enabled]);

  return { sentinelRef, compact };
}

export type PurchaseOrderCardStickyHeaderProps = {
  order: PurchaseOrder;
  supplierName: string;
  creatorLabel: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDeliveryDateChange: (ymd: string | null) => void;
  /** Protokoll / Bestellt / Abschließen / Zurück — nur im vollen Header. */
  actions: ReactNode;
  formatWhen: (iso: string) => string;
  formatDeliveryYmd: (ymd: string | null) => string | null;
};

/**
 * Sticky Bestellungs-Kopf: Lieferant + Lieferdatum bleiben;
 * Meta und Aktions-Buttons klappen beim Sticky-Zustand ein.
 */
export function PurchaseOrderCardStickyHeader({
  order,
  supplierName,
  creatorLabel,
  isExpanded,
  onToggleExpanded,
  onDeliveryDateChange,
  actions,
  formatWhen,
  formatDeliveryYmd,
}: PurchaseOrderCardStickyHeaderProps) {
  const stickyEnabled = isExpanded;
  const { sentinelRef, compact } = usePurchaseOrderStickyCompact(stickyEnabled);
  const deliveryLabel = formatDeliveryYmd(order.deliveryDate);
  const showCompact = stickyEnabled && compact;

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      <div
        className={cn(
          "sticky top-0 z-10 bg-card",
          "supports-[backdrop-filter]:bg-card/95 supports-[backdrop-filter]:backdrop-blur-md",
          "transition-[box-shadow,border-radius] duration-200",
          // Zugeklappt / nicht sticky: Kartenecken mitzeichnen (Parent oft
          // overflow-visible wegen Sticky). Im Compact-Zustand oben am Viewport
          // ohne Radius, damit nichts „schwebt“.
          !isExpanded
            ? "rounded-xl"
            : showCompact
              ? "border-b border-border/40"
              : "rounded-t-xl border-b border-border/40",
          showCompact && "shadow-sm",
        )}
      >
        <div
          className={cn(
            "flex items-stretch gap-0 transition-[min-height] duration-200 ease-out",
            showCompact ? "min-h-11" : "min-h-[3.25rem]",
          )}
        >
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:bg-muted/30 sm:gap-3",
              showCompact ? "px-3 py-2" : "px-4 py-3",
            )}
            onClick={onToggleExpanded}
            aria-expanded={isExpanded}
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "truncate font-semibold tracking-tight transition-[font-size] duration-200",
                    showCompact ? "text-sm" : "text-base",
                  )}
                >
                  {supplierName}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    order.status === "open"
                      ? "bg-accent/15 text-foreground"
                      : order.status === "ordered"
                        ? "bg-amber-500/15 text-amber-950 dark:text-amber-100"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {purchaseOrderStatusLabel(order.status)}
                </span>
              </div>

              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                  showCompact
                    ? "grid-rows-[0fr] opacity-0"
                    : "grid-rows-[1fr] opacity-100",
                )}
                aria-hidden={showCompact}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    {order.lines.length} Position
                    {order.lines.length === 1 ? "" : "en"}
                    {deliveryLabel ? ` · Lieferung ${deliveryLabel}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Erstellt {formatWhen(order.createdAt)}
                    {creatorLabel ? ` · ${creatorLabel}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </button>

          <div
            className={cn(
              "flex shrink-0 items-center gap-2 border-l border-border/50 transition-[max-width,opacity,padding] duration-200 ease-out",
              showCompact
                ? "pointer-events-none max-w-0 overflow-hidden border-l-0 px-0 opacity-0"
                : "max-w-[min(100vw,28rem)] px-3 py-2.5 opacity-100",
            )}
            aria-hidden={showCompact}
          >
            <div className="flex flex-col justify-center gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div
            className={cn(
              "flex items-center gap-3 border-t border-border/40 bg-muted/15 px-3 transition-[padding] duration-200 ease-out sm:px-4",
              showCompact ? "py-1.5" : "py-2.5",
            )}
          >
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">
              Lieferdatum
            </span>
            <DatePickerField
              id={`delivery-${order.id}`}
              size="compact"
              value={order.deliveryDate}
              onChange={onDeliveryDateChange}
              placeholder="Lieferdatum wählen"
              className="max-w-[min(100%,11.5rem)]"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
