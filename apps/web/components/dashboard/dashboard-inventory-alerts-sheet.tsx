"use client";

import { useMemo } from "react";
import {
  DashboardCompactList,
  DashboardCompactListItem,
} from "@/components/dashboard/dashboard-compact-list";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { purchaseOrderStatusLabel } from "@/lib/inventory/purchase-order-status";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/**
 * Heute-Pill „Bestand“ — nur Auffälligkeiten (leer + offen/bestellt),
 * kein Dump aller Bestellungen inkl. Abgeschlossen.
 */
export function DashboardInventoryAlertsSheet({
  open,
  onOpenChange,
  emptyStockCount,
  openOrdersCount,
  openOrderLinesCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emptyStockCount: number;
  openOrdersCount: number;
  openOrderLinesCount: number;
}) {
  const { ingredients } = useIngredientsStorage();
  const { orders } = usePurchaseOrdersStorage();

  const emptyStockIngredients = useMemo(
    () =>
      ingredients
        .filter((i) => i.active !== false && i.currentStock <= 0)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [ingredients],
  );

  const actionableOrders = useMemo(() => {
    return [...orders]
      .filter((o) => o.status === "open" || o.status === "ordered")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders]);

  const openOrders = actionableOrders.filter((o) => o.status === "open");
  const orderedOrders = actionableOrders.filter((o) => o.status === "ordered");

  const empty = emptyStockCount === 0 && openOrdersCount === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Bestand – Auffälligkeiten
          </DrawerTitle>
          <DrawerDescription>
            {empty
              ? "Keine Auffälligkeiten"
              : [
                  emptyStockCount > 0 ? `${emptyStockCount} leer` : null,
                  openOrdersCount > 0
                    ? `${openOrdersCount} offen/bestellt · ${openOrderLinesCount} Pos.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine Auffälligkeiten im Bestand.
            </p>
          ) : (
            <div className="space-y-4">
              {emptyStockIngredients.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Leerer Bestand
                  </h3>
                  <DashboardCompactList aria-label="Leerer Bestand">
                    {emptyStockIngredients.map((row) => (
                      <DashboardCompactListItem
                        key={row.id}
                        href={APP_ROUTES.inventory.overview}
                        title={row.name}
                        meta={`0 ${row.unit}`}
                        stripeVariant="attention"
                        className="py-2.5"
                      />
                    ))}
                  </DashboardCompactList>
                </section>
              ) : null}

              {openOrders.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {purchaseOrderStatusLabel("open")}
                  </h3>
                  <DashboardCompactList aria-label="Offene Bestellungen">
                    {openOrders.map((order) => (
                      <DashboardCompactListItem
                        key={order.id}
                        href={APP_ROUTES.inventory.order}
                        title={order.supplierName}
                        meta={`${order.lines.length} Pos.`}
                        trailing={order.deliveryDate ?? undefined}
                        stripeVariant="attention"
                        className="py-2.5"
                      />
                    ))}
                  </DashboardCompactList>
                </section>
              ) : null}

              {orderedOrders.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {purchaseOrderStatusLabel("ordered")}
                  </h3>
                  <DashboardCompactList aria-label="Bestellte Bestellungen">
                    {orderedOrders.map((order) => (
                      <DashboardCompactListItem
                        key={order.id}
                        href={APP_ROUTES.inventory.order}
                        title={order.supplierName}
                        meta={`${order.lines.length} Pos.`}
                        trailing={order.deliveryDate ?? undefined}
                        stripeVariant="attention"
                        className="py-2.5"
                      />
                    ))}
                  </DashboardCompactList>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
