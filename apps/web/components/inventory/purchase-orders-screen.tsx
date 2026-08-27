"use client";

import { ClipboardList, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useFocusGuardedDraft } from "@/lib/hooks/use-focus-guarded-draft";
import { OrderProtocolDrawer } from "@/components/inventory/order-protocol-drawer";
import {
  PurchaseOrderCloseDeliveryDrawer,
  type PurchaseOrderCloseDeliveryException,
} from "@/components/inventory/purchase-order-close-delivery-drawer";
import { PurchaseOrderMobileLinesList } from "@/components/inventory/purchase-order-mobile-lines-list";
import { PurchaseOrderCardStickyHeader } from "@/components/inventory/purchase-order-card-sticky-header";
import type { LineDeliveryCommit } from "@/components/inventory/purchase-order-line-delivery-controls";
import { PurchaseOrderLineDeliveryControls } from "@/components/inventory/purchase-order-line-delivery-controls";
import { PurchaseOrderStatusChips } from "@/components/inventory/purchase-order-status-chips";
import {
  countPurchaseOrderActiveFilters,
  PurchaseOrdersFilterDrawer,
} from "@/components/inventory/purchase-orders-filter-drawer";
import {
  allPurchaseOrderLinesResolved,
  isLineDeliveryResolved,
  lineDeliveryStockQuantity,
} from "@/lib/inventory/purchase-order-line-delivery";
import {
  purchaseOrderAllowsDeliveryActions,
  type PurchaseOrderStatusFilter,
} from "@/lib/inventory/purchase-order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { INVENTORY_BRANDS_KEY, INVENTORY_INGREDIENT_CATEGORIES_KEY, INVENTORY_PRODUCTION_SITES_KEY, INVENTORY_SUPPLIERS_KEY, INVENTORY_UNITS_KEY } from "@/lib/constants/inventory-storage";
import { SEED_BRANDS, SEED_INGREDIENT_CATEGORIES, SEED_PRODUCTION_SITES, SEED_SUPPLIERS, SEED_UNITS } from "@/lib/data/inventory-seeds";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { resolvePurchaseOrderSupplierName } from "@/lib/inventory/resolve-purchase-order-supplier-name";
import { resolveInventoryUnitDisplayLabel } from "@/lib/inventory/inventory-unit-label-de";
import {
  type OrderProtocolActor,
  type PurchaseOrder,
  type PurchaseOrderLine,
  resolveProtocolCreatorLabel,
} from "@/lib/types/purchase-order";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";
import { PurchaseOrderTableExportSheet } from "@/components/inventory/purchase-order-table-export-sheet";
import {
  sortPurchaseOrderLines,
  type PurchaseOrderLineSortDir,
  type PurchaseOrderLineSortKey,
} from "@/lib/inventory/sort-purchase-order-lines";
import {
  ModuleDataTableFrame,
} from "@/lib/ui/module-paginated-data-table";
import {
  moduleDataTableHeadCellDenseClassName,
  moduleDataTableHeadRowNormalCaseClassName,
  moduleTableFullscreenChromeInsetDenseClassName,
} from "@/lib/ui/module-data-table";
import {
  ModuleTableSortHeader,
  ModuleTableStaticColumnHeader,
} from "@/lib/ui/module-table-sort-header";

const df = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatWhen(iso: string) {
  try {
    return df.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDeliveryYmd(ymd: string | null) {
  if (!ymd) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
      new Date(`${ymd}T12:00:00`),
    );
  } catch {
    return ymd;
  }
}

const orderQtyInputClass =
  "h-9 w-full min-w-[4.5rem] rounded-xl border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function OrderLineQtyCell({
  orderId,
  line,
  readOnly,
  actor,
  onCommit,
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
}) {
  const { draft, setDraft, focusProps } = useFocusGuardedDraft(
    line.quantity,
    line.id,
  );

  const commit = useCallback(async () => {
    if (readOnly) return;
    const q = Number.parseFloat(draft.replace(",", "."));
    if (Number.isNaN(q) || q < 0) {
      toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
      setDraft(String(line.quantity));
      return;
    }
    const ok = await onCommit(orderId, line.id, q, actor);
    if (!ok) {
      setDraft(String(line.quantity));
    }
  }, [draft, line.id, line.quantity, onCommit, orderId, readOnly, actor, setDraft]);

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={readOnly}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      {...focusProps}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        orderQtyInputClass,
        "text-right",
        readOnly && "cursor-not-allowed opacity-60",
      )}
      aria-label={`Menge ${line.ingredientName}`}
    />
  );
}

export function PurchaseOrdersScreen() {
  const { profile } = useRestaurantProfile();
  const { actor, isHydrated: userNameHydrated } = usePersonalProfileNames();
  const {
    orders,
    isHydrated,
    markOrderOrdered,
    closeOrder,
    reopenOrder,
    setOrderDeliveryDate,
    updateLineQuantity,
    setLineDelivery,
    clearLineDelivery,
    resolveOpenDeliveriesAndClose,
    syncSupplierNamesFromTaxonomy,
    healCreatorAttribution,
  } = usePurchaseOrdersStorage();
  const {
    ingredients,
    updateIngredient,
    applyDeliveryStockDeltas,
    isHydrated: ingredientsHydrated,
  } = useIngredientsStorage();
  const suppliers = useInventoryTaxonomyStorage(
    INVENTORY_SUPPLIERS_KEY,
    SEED_SUPPLIERS,
  );
  const productionSites = useInventoryTaxonomyStorage(
    INVENTORY_PRODUCTION_SITES_KEY,
    SEED_PRODUCTION_SITES,
  );
  const brands = useInventoryTaxonomyStorage(
    INVENTORY_BRANDS_KEY,
    SEED_BRANDS,
  );
  const ingredientCategories = useInventoryTaxonomyStorage(
    INVENTORY_INGREDIENT_CATEGORIES_KEY,
    SEED_INGREDIENT_CATEGORIES,
  );
  const units = useInventoryTaxonomyStorage(INVENTORY_UNITS_KEY, SEED_UNITS);
  const [statusFilter, setStatusFilter] =
    useState<PurchaseOrderStatusFilter>("open");
  const [supplierFilterId, setSupplierFilterId] = useState<string>("all");
  const [productionFilterId, setProductionFilterId] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [protocolOrderId, setProtocolOrderId] = useState<string | null>(null);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [closeConfirmOrderId, setCloseConfirmOrderId] = useState<string | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lineSortKey, setLineSortKey] =
    useState<PurchaseOrderLineSortKey>("categoryId");
  const [lineSortDir, setLineSortDir] = useState<PurchaseOrderLineSortDir>("asc");

  const toggleLineSort = useCallback((key: PurchaseOrderLineSortKey) => {
    setLineSortKey((prev) => {
      if (prev !== key) {
        setLineSortDir("asc");
        return key;
      }
      setLineSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }, []);

  const protocolOrder = useMemo(
    () => (protocolOrderId ? orders.find((o) => o.id === protocolOrderId) ?? null : null),
    [orders, protocolOrderId],
  );

  const supplierNameForOrder = useCallback(
    (order: PurchaseOrder) =>
      resolvePurchaseOrderSupplierName(order, suppliers.items),
    [suppliers.items],
  );

  const creatorLabelForOrder = useCallback(
    (order: PurchaseOrder) => resolveProtocolCreatorLabel(order),
    [],
  );

  const unitLabelForLine = useCallback(
    (line: Pick<PurchaseOrderLine, "unitId" | "unitLabel">) =>
      resolveInventoryUnitDisplayLabel(line.unitId, units.items, line.unitLabel),
    [units.items],
  );

  const supplierSyncSignature = useMemo(
    () =>
      [
        ...orders.map((o) => `${o.id}:${o.supplierId}:${o.supplierName}`),
        ...suppliers.items.map((s) => `${s.id}:${s.name}`),
      ].join("|"),
    [orders, suppliers.items],
  );

  useEffect(() => {
    if (!isHydrated || !suppliers.isHydrated) return;
    if (suppliers.items.length === 0 || orders.length === 0) return;
    void syncSupplierNamesFromTaxonomy(suppliers.items);
    // Nur wenn Namen/IDs sich ändern — nicht bei jeder Render-Identität.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature deckt relevante Änderungen ab
  }, [isHydrated, suppliers.isHydrated, supplierSyncSignature]);

  useEffect(() => {
    if (!isHydrated || orders.length === 0) return;
    void healCreatorAttribution();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmalig pro Hydration / Order-Set mit local_profile
  }, [
    isHydrated,
    orders
      .map((o) => `${o.id}:${o.createdBy}:${o.createdByUserSource ?? ""}`)
      .join("|"),
  ]);

  const supplierFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const o of orders) {
      byId.set(o.supplierId, supplierNameForOrder(o));
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "de"))
      .map(([value, label]) => ({ value, label }));
  }, [orders, supplierNameForOrder]);

  const productionFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const o of orders) {
      for (const line of o.lines) {
        const ing = ingredients.find((i) => i.id === line.ingredientId);
        if (ing?.productionSiteId?.trim()) ids.add(ing.productionSiteId);
      }
    }
    const labelById = new Map(
      productionSites.items.map((s) => [s.id, s.name] as const),
    );
    return [...ids]
      .map((id) => ({ value: id, label: labelById.get(id) ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [orders, ingredients, productionSites.items]);

  useEffect(() => {
    if (supplierFilterId === "all") return;
    if (!supplierFilterOptions.some((o) => o.value === supplierFilterId)) {
      setSupplierFilterId("all");
    }
  }, [supplierFilterId, supplierFilterOptions]);

  useEffect(() => {
    if (productionFilterId === "all") return;
    if (!productionFilterOptions.some((o) => o.value === productionFilterId)) {
      setProductionFilterId("all");
    }
  }, [productionFilterId, productionFilterOptions]);

  const statusCounts = useMemo(() => {
    const counts: Record<PurchaseOrderStatusFilter, number> = {
      open: 0,
      ordered: 0,
      closed: 0,
    };
    for (const o of orders) {
      if (o.status in counts) counts[o.status as PurchaseOrderStatusFilter] += 1;
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => o.status === statusFilter)
      .filter((o) => supplierFilterId === "all" || o.supplierId === supplierFilterId)
      .filter((o) => {
        if (productionFilterId === "all") return true;
        return o.lines.some((line) => {
          const ing = ingredients.find((i) => i.id === line.ingredientId);
          return ing?.productionSiteId === productionFilterId;
        });
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, statusFilter, supplierFilterId, productionFilterId, ingredients]);

  const filterActiveCount = useMemo(
    () =>
      countPurchaseOrderActiveFilters({
        supplierFilterId,
        productionFilterId,
      }),
    [supplierFilterId, productionFilterId],
  );

  const ready =
    isHydrated &&
    userNameHydrated &&
    ingredientsHydrated &&
    productionSites.isHydrated &&
    units.isHydrated;

  const openProtocol = (o: PurchaseOrder) => {
    setProtocolOrderId(o.id);
    setProtocolOpen(true);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  };

  const commitLineQty = useCallback(
    async (orderId: string, lineId: string, qty: number, user: OrderProtocolActor) =>
      updateLineQuantity(orderId, lineId, qty, user),
    [updateLineQuantity],
  );

  const applyStockDelta = useCallback(
    async (
      order: PurchaseOrder,
      line: PurchaseOrderLine,
      stockDelta: number,
      mode: "delivery" | "revert",
    ): Promise<boolean> => {
      if (stockDelta === 0) return true;
      const ing = ingredients.find((i) => i.id === line.ingredientId);
      if (!ing) {
        toast.error("Zutat nicht gefunden – Bestand kann nicht angepasst werden.");
        return false;
      }
      const newStock = ing.currentStock + stockDelta;
      if (newStock < 0) {
        toast.error(
          "Bestand reicht für diese Mengenänderung nicht aus.",
        );
        return false;
      }
      const okStock = await updateIngredient(
        ing.id,
        { currentStock: newStock },
        {
          stockActor: actor,
          stockUnitLabel: unitLabelForLine(line),
          ...(mode === "delivery"
            ? {
                stockFromDelivery: {
                  orderId: order.id,
                  supplierName: supplierNameForOrder(order),
                },
              }
            : {
                stockDeliveryRevert: {
                  orderId: order.id,
                  supplierName: supplierNameForOrder(order),
                },
              }),
        },
      );
      if (!okStock) {
        toast.error("Bestand konnte nicht gespeichert werden.");
        return false;
      }
      return true;
    },
    [actor, ingredients, supplierNameForOrder, unitLabelForLine, updateIngredient],
  );

  const handleSetLineDelivery = useCallback(
    async (orderId: string, lineId: string, input: LineDeliveryCommit) => {
      const order = orders.find((o) => o.id === orderId);
      const line = order?.lines.find((l) => l.id === lineId);
      if (!order || !line) return;
      if (!purchaseOrderAllowsDeliveryActions(order.status)) return;

      const prevStock = lineDeliveryStockQuantity(line);
      let nextStock = 0;
      if (input.status === "delivered") {
        nextStock =
          typeof input.deliveredQuantity === "number"
            ? input.deliveredQuantity
            : line.quantity;
      } else if (input.status === "partial") {
        nextStock = input.deliveredQuantity ?? 0;
      }
      const previewDelta = nextStock - prevStock;

      // Sync-Check vor Optimistic UI — kein kurzes Aufblitzen bei ungültigem Bestand
      if (previewDelta !== 0) {
        const ing = ingredients.find((i) => i.id === line.ingredientId);
        if (!ing) {
          toast.error("Zutat nicht gefunden – Bestand kann nicht angepasst werden.");
          return;
        }
        if (ing.currentStock + previewDelta < 0) {
          toast.error("Bestand reicht für diese Mengenänderung nicht aus.");
          return;
        }
      }

      // Zuerst Liefer-Antwort (optimistic), danach Bestand — Chip reagiert sofort
      const result = await setLineDelivery(orderId, lineId, input, actor);
      if (!result.ok) {
        toast.error("Liefer-Antwort konnte nicht gespeichert werden.");
        return;
      }

      if (
        !(await applyStockDelta(
          order,
          line,
          previewDelta,
          previewDelta >= 0 ? "delivery" : "revert",
        ))
      ) {
        await clearLineDelivery(orderId, lineId, actor);
        return;
      }

      if (result.stockDelta !== previewDelta && result.stockDelta !== 0) {
        // rare drift — ignore; persist already done
      }
      const label =
        input.status === "delivered"
          ? "geliefert"
          : input.status === "not_delivered"
            ? "nicht geliefert"
            : "abweichend";
      if (result.autoClosed) {
        toast.success(
          `„${line.ingredientName}“ ${label} – Bestellung abgeschlossen.`,
        );
        setStatusFilter("closed");
      } else if (result.stockDelta > 0) {
        toast.success(
          `„${line.ingredientName}“ ${label} – Bestand +${result.stockDelta} ${unitLabelForLine(line)}.`,
        );
      } else if (result.stockDelta < 0) {
        toast.success(
          `„${line.ingredientName}“ ${label} – Bestand ${result.stockDelta} ${unitLabelForLine(line)}.`,
        );
      } else {
        toast.success(`„${line.ingredientName}“ als ${label} markiert.`);
      }
    },
    [
      actor,
      applyStockDelta,
      clearLineDelivery,
      ingredients,
      orders,
      setLineDelivery,
      unitLabelForLine,
    ],
  );

  const handleClearLineDelivery = useCallback(
    async (orderId: string, lineId: string) => {
      const order = orders.find((o) => o.id === orderId);
      const line = order?.lines.find((l) => l.id === lineId);
      if (!order || !line) return;
      const prevStock = lineDeliveryStockQuantity(line);

      // Optimistic zurücksetzen zuerst — Chip reagiert sofort
      const result = await clearLineDelivery(orderId, lineId, actor);
      if (!result.ok) {
        toast.error("Liefer-Antwort konnte nicht zurückgesetzt werden.");
        return;
      }

      if (!(await applyStockDelta(order, line, -prevStock, "revert"))) {
        await setLineDelivery(
          orderId,
          lineId,
          {
            status: line.deliveryStatus ?? "delivered",
            deliveredQuantity: line.deliveredQuantity,
            note: line.deliveryNote,
          },
          actor,
        );
        return;
      }

      toast.success(
        prevStock > 0
          ? `Lieferung von „${line.ingredientName}“ zurückgesetzt – Bestand −${prevStock} ${unitLabelForLine(line)}.`
          : `Liefer-Antwort zu „${line.ingredientName}“ zurückgesetzt.`,
      );
    },
    [
      actor,
      applyStockDelta,
      clearLineDelivery,
      orders,
      setLineDelivery,
      unitLabelForLine,
    ],
  );

  const requestCloseOrder = useCallback(
    (order: PurchaseOrder) => {
      if (order.status !== "ordered") return;
      if (allPurchaseOrderLinesResolved(order.lines)) {
        void closeOrder(order.id, actor).then((ok) => {
          if (ok) setStatusFilter("closed");
        });
        return;
      }
      setCloseConfirmOrderId(order.id);
    },
    [actor, closeOrder],
  );

  const closeDeliveryOrder = useMemo(
    () => orders.find((o) => o.id === closeConfirmOrderId) ?? null,
    [closeConfirmOrderId, orders],
  );

  const handleCloseWithDeliveries = useCallback(
    async (
      exceptions: PurchaseOrderCloseDeliveryException[],
      options: { skipStock: boolean },
    ) => {
      const order = closeDeliveryOrder;
      if (!order) return;

      const result = await resolveOpenDeliveriesAndClose(
        order.id,
        exceptions,
        actor,
      );
      if (!result.ok) {
        toast.error("Bestellung konnte nicht abgeschlossen werden.");
        return;
      }

      const skipStock = options.skipStock === true;
      const stockOk = skipStock
        ? true
        : await applyDeliveryStockDeltas(
            result.stockDeltas.map((d) => ({
              ingredientId: d.ingredientId,
              delta: d.delta,
              unitId: d.unitId,
              unitLabel: d.unitLabel,
              orderId: order.id,
              supplierName: supplierNameForOrder(order),
            })),
            actor,
          );
      if (!stockOk) {
        toast.error(
          "Lieferung gespeichert, aber Bestand konnte nicht vollständig angepasst werden.",
        );
      } else {
        const openCount = order.lines.filter(
          (l) => !isLineDeliveryResolved(l),
        ).length;
        const deliveredCount = openCount - exceptions.length;
        const stockSum = skipStock
          ? 0
          : result.stockDeltas.reduce((s, d) => s + d.delta, 0);
        if (skipStock) {
          toast.success(
            exceptions.length === 0
              ? "Alles geliefert – Bestand unverändert."
              : `Abgeschlossen: ${deliveredCount} geliefert, ${exceptions.length} Ausnahme${exceptions.length === 1 ? "" : "n"} – Bestand unverändert.`,
          );
        } else if (exceptions.length === 0) {
          toast.success(
            stockSum > 0
              ? `Alles geliefert – Bestand +${stockSum}.`
              : "Alles geliefert – Bestellung abgeschlossen.",
          );
        } else {
          toast.success(
            stockSum > 0
              ? `Abgeschlossen: ${deliveredCount} geliefert, ${exceptions.length} Ausnahme${exceptions.length === 1 ? "" : "n"} – Bestand +${stockSum}.`
              : `Abgeschlossen: ${deliveredCount} geliefert, ${exceptions.length} Ausnahme${exceptions.length === 1 ? "" : "n"}.`,
          );
        }
      }

      setCloseConfirmOrderId(null);
      setStatusFilter("closed");
    },
    [
      actor,
      applyDeliveryStockDeltas,
      closeDeliveryOrder,
      resolveOpenDeliveriesAndClose,
      supplierNameForOrder,
    ],
  );

  const restaurantName = profile.name.trim() || undefined;

  return (
    <div
      className={cn(
        "transition-opacity duration-300",
        !ready && "opacity-0",
        ready && "opacity-100",
      )}
    >
      <div className="mb-4 space-y-3">
        <PurchaseOrderStatusChips
          value={statusFilter}
          onChange={setStatusFilter}
          counts={statusCounts}
          disabled={!ready}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="size-4 shrink-0 opacity-80" aria-hidden />
            <span>
              {filtered.length} Bestellung{filtered.length === 1 ? "" : "en"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className={moduleSearchFilterButtonWrapClassName}>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className={moduleSearchFilterButtonClassName}
                aria-label="Filter"
                onClick={() => setFilterOpen(true)}
              >
                <Filter className="size-4" />
              </Button>
              {filterActiveCount > 0 ? (
                <Badge
                  variant="secondary"
                  className={moduleSearchFilterActiveBadgeClassName}
                >
                  {filterActiveCount}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PurchaseOrdersFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        supplierFilterId={supplierFilterId}
        onSupplierFilterIdChange={setSupplierFilterId}
        supplierFilterOptions={supplierFilterOptions}
        productionFilterId={productionFilterId}
        onProductionFilterIdChange={setProductionFilterId}
        productionFilterOptions={productionFilterOptions}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">
            {statusFilter === "open"
              ? "Keine offenen Bestellungen"
              : statusFilter === "ordered"
                ? "Keine bestellten Bestellungen"
                : "Keine abgeschlossenen Bestellungen"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {statusFilter === "open"
              ? "Lege über die Übersicht mit dem Feld „Bestellung“ Mengen fest – es wird automatisch eine offene Bestellung je Lieferant geführt."
              : statusFilter === "ordered"
                ? "Markiere eine offene Bestellung mit „Bestellt“, sobald sie beim Lieferanten ist."
                : "Abgeschlossene Bestellungen erscheinen hier."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isExpanded = Boolean(expanded[order.id]);
            return (
              <section
                key={order.id}
                className="overflow-visible rounded-xl border border-border/50 bg-card shadow-none dark:shadow-sm"
              >
                <PurchaseOrderCardStickyHeader
                  order={order}
                  supplierName={supplierNameForOrder(order)}
                  creatorLabel={creatorLabelForOrder(order)}
                  isExpanded={isExpanded}
                  onToggleExpanded={() => toggleExpanded(order.id)}
                  onDeliveryDateChange={(ymd) =>
                    void setOrderDeliveryDate(order.id, ymd)
                  }
                  formatWhen={formatWhen}
                  formatDeliveryYmd={formatDeliveryYmd}
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full border-border/60"
                        onClick={() => openProtocol(order)}
                      >
                        Protokoll
                      </Button>
                      {order.status === "open" ? (
                        <Button
                          type="button"
                          size="sm"
                          className={cn(
                            "rounded-full px-3 sm:px-4",
                            brandActionButtonRoundedClassName,
                          )}
                          onClick={() =>
                            void markOrderOrdered(order.id, actor).then((ok) => {
                              if (ok) setStatusFilter("ordered");
                            })
                          }
                        >
                          Bestellt
                        </Button>
                      ) : null}
                      {order.status === "ordered" ? (
                        <Button
                          type="button"
                          size="sm"
                          className={cn(
                            "rounded-full px-3 sm:px-4",
                            brandActionButtonRoundedClassName,
                          )}
                          onClick={() => requestCloseOrder(order)}
                        >
                          Abschließen
                        </Button>
                      ) : null}
                      {order.status !== "open" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="rounded-full px-3 sm:px-4"
                          onClick={() => {
                            void reopenOrder(order.id, actor).then((ok) => {
                              if (!ok) return;
                              if (order.status === "closed") {
                                setStatusFilter("ordered");
                              } else {
                                setStatusFilter("open");
                              }
                            });
                          }}
                        >
                          Zurück
                        </Button>
                      ) : null}
                    </>
                  }
                />

                {isExpanded ? (
                  <div className="border-t border-border/50">
                    <div className="md:hidden">
                      <PurchaseOrderMobileLinesList
                        order={order}
                        lines={sortPurchaseOrderLines(
                          order.lines,
                          ingredients,
                          ingredientCategories.items,
                          lineSortKey,
                          lineSortDir,
                          units.items,
                        )}
                        ingredients={ingredients}
                        actor={actor}
                        onCommitQty={commitLineQty}
                        unitLabelForLine={unitLabelForLine}
                        onSetDelivery={handleSetLineDelivery}
                        onClearDelivery={handleClearLineDelivery}
                      />
                    </div>

                    <div className="hidden md:block">
                    <ModuleDataTableFrame
                      tableFullscreen
                      fullscreenTitle={`Bestellung · ${supplierNameForOrder(order)}`}
                      summaryText={`${order.lines.length} Position${order.lines.length === 1 ? "" : "en"}`}
                      toolbarClassName="px-4 sm:px-5"
                      shellClassName="overflow-hidden rounded-none bg-transparent ring-0 shadow-none"
                      scrollClassName="overflow-x-auto"
                      fullscreenChromeInsetClassName={
                        moduleTableFullscreenChromeInsetDenseClassName
                      }
                      renderTableExportSheet={
                        order.lines.length > 0
                          ? ({ open, onOpenChange }) => (
                              <PurchaseOrderTableExportSheet
                                open={open}
                                onOpenChange={onOpenChange}
                                order={order}
                                ingredients={ingredients}
                                categories={ingredientCategories.items}
                                productionSites={productionSites.items}
                                brands={brands.items}
                                units={units.items}
                                restaurantName={restaurantName}
                              />
                            )
                          : undefined
                      }
                    >
                      <table className="w-full min-w-[920px] text-sm">
                        <thead>
                          <tr className={moduleDataTableHeadRowNormalCaseClassName}>
                            <ModuleTableSortHeader
                              label="Zutat"
                              sortKey="categoryId"
                              activeKey={lineSortKey}
                              dir={lineSortDir}
                              onSort={toggleLineSort}
                              className={cn(
                                "min-w-[12rem]",
                                moduleDataTableHeadCellDenseClassName,
                              )}
                            />
                            <ModuleTableSortHeader
                              label="Marke"
                              sortKey="brandLabel"
                              activeKey={lineSortKey}
                              dir={lineSortDir}
                              onSort={toggleLineSort}
                              className={cn(
                                "min-w-[8rem]",
                                moduleDataTableHeadCellDenseClassName,
                              )}
                            />
                            <ModuleTableSortHeader
                              label="Bestand"
                              sortKey="currentStock"
                              activeKey={lineSortKey}
                              dir={lineSortDir}
                              onSort={toggleLineSort}
                              align="right"
                              className={cn(
                                "min-w-[6rem]",
                                moduleDataTableHeadCellDenseClassName,
                              )}
                            />
                            <ModuleTableSortHeader
                              label="Menge"
                              sortKey="quantity"
                              activeKey={lineSortKey}
                              dir={lineSortDir}
                              onSort={toggleLineSort}
                              align="right"
                              className={cn("w-36", moduleDataTableHeadCellDenseClassName)}
                            />
                            <ModuleTableSortHeader
                              label="Einheit"
                              sortKey="unitLabel"
                              activeKey={lineSortKey}
                              dir={lineSortDir}
                              onSort={toggleLineSort}
                              className={cn(
                                "min-w-[8rem]",
                                moduleDataTableHeadCellDenseClassName,
                              )}
                            />
                            <ModuleTableStaticColumnHeader
                              label="Lieferung"
                              className={cn(
                                "min-w-[12rem]",
                                moduleDataTableHeadCellDenseClassName,
                              )}
                            />
                          </tr>
                        </thead>
                        <tbody>
                          {order.lines.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-8 text-center text-muted-foreground"
                              >
                                Noch keine Positionen.
                              </td>
                            </tr>
                          ) : (
                            sortPurchaseOrderLines(
                              order.lines,
                              ingredients,
                              ingredientCategories.items,
                              lineSortKey,
                              lineSortDir,
                              units.items,
                            ).map((line) => {
                              const ingRow = ingredients.find((i) => i.id === line.ingredientId);
                              return (
                              <tr
                                key={line.id}
                                className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/60"
                              >
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {line.ingredientName}
                                </td>
                                <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground">
                                  {line.brandLabel ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                  {ingRow != null ? ingRow.currentStock : "—"}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <OrderLineQtyCell
                                    orderId={order.id}
                                    line={line}
                                    readOnly={false}
                                    actor={actor}
                                    onCommit={commitLineQty}
                                  />
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {unitLabelForLine(line)}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  {purchaseOrderAllowsDeliveryActions(order.status) ? (
                                    <PurchaseOrderLineDeliveryControls
                                      line={line}
                                      dense
                                      onCommit={(input) =>
                                        void handleSetLineDelivery(
                                          order.id,
                                          line.id,
                                          input,
                                        )
                                      }
                                      onClear={() =>
                                        void handleClearLineDelivery(
                                          order.id,
                                          line.id,
                                        )
                                      }
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </ModuleDataTableFrame>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <OrderProtocolDrawer
        order={protocolOrder}
        open={protocolOpen}
        units={units.items}
        onOpenChange={(o) => {
          setProtocolOpen(o);
          if (!o) setProtocolOrderId(null);
        }}
      />

      <PurchaseOrderCloseDeliveryDrawer
        order={closeDeliveryOrder}
        open={closeConfirmOrderId != null}
        onOpenChange={(open) => {
          if (!open) setCloseConfirmOrderId(null);
        }}
        unitLabelForLine={unitLabelForLine}
        onConfirm={handleCloseWithDeliveries}
      />
    </div>
  );
}
