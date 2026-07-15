"use client";

import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { protocolDeltaWrapClass } from "@/components/inventory/protocol-menge-colors";
import { resolveInventoryUnitDisplayLabel } from "@/lib/inventory/inventory-unit-label-de";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type { PurchaseOrder, PurchaseOrderLogEntry } from "@/lib/types/purchase-order";
import { resolveLogEntryUserLabel, resolveProtocolCreatorLabel } from "@/lib/types/purchase-order";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";

const df = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** dd.mm.yyyy, HH:MM */
const protocolWhenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  try {
    return df.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatProtocolWhen(iso: string) {
  try {
    return protocolWhenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function orderProtocolQuantityCell(
  e: PurchaseOrderLogEntry,
  units: InventoryTaxonomyDefinition[],
): ReactNode {
  const unitLabel = resolveInventoryUnitDisplayLabel(e.unitId, units, e.unitLabel);
  switch (e.kind) {
    case "add_to_order":
      return (
        <span className="tabular-nums">
          <span className={protocolDeltaWrapClass(e.quantity)}>+{e.quantity}</span>{" "}
          <span className="text-muted-foreground">{unitLabel}</span>
        </span>
      );
    case "quantity_change": {
      const delta = e.toQuantity - e.fromQuantity;
      const sign = delta > 0 ? "+" : "";
      return (
        <span className="tabular-nums">
          <span className="text-foreground">{e.fromQuantity}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-foreground">{e.toQuantity}</span>{" "}
          <span className={protocolDeltaWrapClass(delta)}>({sign}{delta})</span>{" "}
          <span className="text-muted-foreground">{unitLabel}</span>
        </span>
      );
    }
    case "marked_delivered":
    case "delivery_reverted":
      return "—";
    case "legacy_adjustment": {
      const d = e.quantityDelta;
      return (
        <span className="tabular-nums">
          <span className={protocolDeltaWrapClass(d)}>
            {d > 0 ? "+" : ""}
            {d}
          </span>{" "}
          <span className="text-muted-foreground">{unitLabel}</span>
        </span>
      );
    }
    default:
      return "—";
  }
}

function actionColumn(e: PurchaseOrderLogEntry): string {
  switch (e.kind) {
    case "add_to_order":
      return "Erstellt";
    case "quantity_change":
    case "legacy_adjustment":
      return "Bearbeitet";
    case "marked_delivered":
      return "Geliefert markiert";
    case "delivery_reverted":
      return "Geliefert rückgängig";
    default:
      return "—";
  }
}

type OrderProtocolDrawerProps = {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: InventoryTaxonomyDefinition[];
};

export function OrderProtocolDrawer({
  order,
  open,
  onOpenChange,
  units,
}: OrderProtocolDrawerProps) {
  const entries = useMemo(
    () => (order ? [...order.log].reverse() : []),
    [order],
  );

  const creatorLabel = order ? resolveProtocolCreatorLabel(order) : "";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent
        className={drawerContentClassName("wide")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Bestellprotokoll
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            {order ? (
              <>
                {order.supplierName} · erstellt {formatWhen(order.createdAt)}
                {creatorLabel ? ` von ${creatorLabel}` : ""}
                {order.deliveryDate ? (
                  <>
                    {" "}
                    · Lieferung geplant{" "}
                    {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
                      new Date(`${order.deliveryDate}T12:00:00`),
                    )}
                  </>
                ) : null}
              </>
            ) : (
              "Keine Bestellung ausgewählt."
            )}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName("4-6")}>
          <DrawerFormSection contentPadding="4-6">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Einträge.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowMutedClassName}>
                    <th className="whitespace-nowrap px-2 py-2 sm:px-3">Datum</th>
                    <th className="min-w-[7rem] px-2 py-2 sm:px-3">Nutzer</th>
                    <th className="min-w-[8rem] px-2 py-2 sm:px-3">Name Zutat</th>
                    <th className="min-w-[6.5rem] px-2 py-2 sm:px-3">Mengenänderung</th>
                    <th className="min-w-[7rem] px-2 py-2 sm:px-3">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border/35 align-top last:border-0 odd:bg-muted/15"
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground tabular-nums sm:px-3 sm:py-2">
                        {formatProtocolWhen(e.at)}
                      </td>
                      <td className="px-2 py-1.5 font-medium text-foreground sm:px-3 sm:py-2">
                        {resolveLogEntryUserLabel(e)}
                      </td>
                      <td
                        className="max-w-[14rem] truncate px-2 py-1.5 text-foreground sm:max-w-none sm:px-3 sm:py-2"
                        title={e.ingredientName}
                      >
                        {e.ingredientName}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums sm:px-3 sm:py-2">
                        {orderProtocolQuantityCell(e, units)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                        {actionColumn(e)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
