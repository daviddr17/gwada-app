"use client";

import { ChevronDown, ClipboardList, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OrderProtocolDrawer } from "@/components/inventory/order-protocol-drawer";
import { PurchaseOrderMobileLinesList } from "@/components/inventory/purchase-order-mobile-lines-list";
import {
  countPurchaseOrderActiveFilters,
  PurchaseOrdersFilterDrawer,
} from "@/components/inventory/purchase-orders-filter-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { INVENTORY_BRANDS_KEY, INVENTORY_INGREDIENT_CATEGORIES_KEY, INVENTORY_PRODUCTION_SITES_KEY, INVENTORY_SUPPLIERS_KEY } from "@/lib/constants/inventory-storage";
import { SEED_BRANDS, SEED_INGREDIENT_CATEGORIES, SEED_PRODUCTION_SITES, SEED_SUPPLIERS } from "@/lib/data/inventory-seeds";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import { resolvePurchaseOrderSupplierName } from "@/lib/inventory/resolve-purchase-order-supplier-name";
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

const scopeItems = {
  active: "Aktive Bestellungen",
  past: "Vergangene Bestellungen",
} as const;

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
  const [draft, setDraft] = useState(() => String(line.quantity));

  useEffect(() => {
    setDraft(String(line.quantity));
  }, [line.quantity]);

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
  }, [draft, line.id, line.quantity, onCommit, orderId, readOnly, actor]);

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={readOnly}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
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
    closeOrder,
    reopenOrder,
    setOrderDeliveryDate,
    updateLineQuantity,
    markLineDelivered,
    unmarkLineDelivered,
    syncSupplierNamesFromTaxonomy,
    healCreatorAttribution,
  } = usePurchaseOrdersStorage();
  const {
    ingredients,
    updateIngredient,
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
  const [scope, setScope] = useState<keyof typeof scopeItems>("active");
  const [supplierFilterId, setSupplierFilterId] = useState<string>("all");
  const [productionFilterId, setProductionFilterId] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [protocolOrderId, setProtocolOrderId] = useState<string | null>(null);
  const [protocolOpen, setProtocolOpen] = useState(false);
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

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (scope === "active" ? o.status === "open" : o.status === "closed"))
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
  }, [orders, scope, supplierFilterId, productionFilterId, ingredients]);

  const filterActiveCount = useMemo(
    () =>
      countPurchaseOrderActiveFilters({
        scope,
        supplierFilterId,
        productionFilterId,
      }),
    [scope, supplierFilterId, productionFilterId],
  );

  const ready =
    isHydrated &&
    userNameHydrated &&
    ingredientsHydrated &&
    productionSites.isHydrated;

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

  const handleMarkLineDelivered = useCallback(
    async (orderId: string, lineId: string) => {
      const order = orders.find((o) => o.id === orderId);
      const line = order?.lines.find((l) => l.id === lineId);
      const ing = line ? ingredients.find((i) => i.id === line.ingredientId) : undefined;
      if (!order || order.status !== "closed" || !line || line.deliveredAt) return;
      if (!ing) {
        toast.error("Zutat nicht gefunden – Bestand kann nicht erhöht werden.");
        return;
      }
      const newStock = ing.currentStock + line.quantity;
      const okStock = await updateIngredient(ing.id, { currentStock: newStock }, {
        stockActor: actor,
        stockUnitLabel: line.unitLabel,
        stockFromDelivery: {
          orderId: order.id,
          supplierName: supplierNameForOrder(order),
        },
      });
      if (!okStock) {
        toast.error("Bestand konnte nicht gespeichert werden.");
        return;
      }
      if (!(await markLineDelivered(orderId, lineId, actor))) {
        await updateIngredient(ing.id, { currentStock: ing.currentStock }, { skipStockLog: true });
        toast.error(
          "Bestellung konnte nicht aktualisiert werden. Bestand wurde zurückgesetzt.",
        );
        return;
      }
      toast.success(
        `„${line.ingredientName}“ als geliefert markiert – Bestand um ${line.quantity} ${line.unitLabel} erhöht.`,
      );
    },
    [
      actor,
      ingredients,
      markLineDelivered,
      orders,
      supplierNameForOrder,
      updateIngredient,
    ],
  );

  const handleUnmarkLineDelivered = useCallback(
    async (orderId: string, lineId: string) => {
      const order = orders.find((o) => o.id === orderId);
      const line = order?.lines.find((l) => l.id === lineId);
      const ing = line ? ingredients.find((i) => i.id === line.ingredientId) : undefined;
      if (!order || order.status !== "closed" || !line || !line.deliveredAt) return;
      if (!ing) {
        toast.error("Zutat nicht gefunden – Bestand kann nicht angepasst werden.");
        return;
      }
      const newStock = ing.currentStock - line.quantity;
      if (newStock < 0) {
        toast.error(
          "Rückgängig nicht möglich: Bestand reicht für diese Menge nicht aus.",
        );
        return;
      }
      const okStock = await updateIngredient(ing.id, { currentStock: newStock }, {
        stockActor: actor,
        stockUnitLabel: line.unitLabel,
        stockDeliveryRevert: {
          orderId: order.id,
          supplierName: supplierNameForOrder(order),
        },
      });
      if (!okStock) {
        toast.error("Bestand konnte nicht gespeichert werden.");
        return;
      }
      if (!(await unmarkLineDelivered(orderId, lineId, actor))) {
        await updateIngredient(ing.id, { currentStock: ing.currentStock }, { skipStockLog: true });
        toast.error(
          "Bestellung konnte nicht aktualisiert werden. Bestand wurde zurückgesetzt.",
        );
        return;
      }
      toast.success(
        `Lieferung von „${line.ingredientName}“ rückgängig – Bestand um ${line.quantity} ${line.unitLabel} reduziert.`,
      );
    },
    [
      actor,
      ingredients,
      orders,
      supplierNameForOrder,
      unmarkLineDelivered,
      updateIngredient,
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
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="size-4 shrink-0 opacity-80" aria-hidden />
          <span>
            {filtered.length} Bestellung{filtered.length === 1 ? "" : "en"}
          </span>
        </div>
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

      <PurchaseOrdersFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        scope={scope}
        onScopeChange={setScope}
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
            {scope === "active"
              ? "Keine aktiven Bestellungen"
              : "Keine vergangenen Bestellungen"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {scope === "active"
              ? "Lege über die Übersicht mit dem Feld „Bestellung“ Mengen fest – es wird automatisch eine offene Bestellung je Lieferant geführt."
              : "Abgeschlossene Bestellungen erscheinen hier."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isExpanded = Boolean(expanded[order.id]);
            const deliveryLabel = formatDeliveryYmd(order.deliveryDate);
            return (
              <section
                key={order.id}
                className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-none dark:shadow-sm"
              >
                <div className="flex min-h-[3.25rem] items-stretch gap-0">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/30 sm:gap-3 sm:px-4"
                    onClick={() => toggleExpanded(order.id)}
                    aria-expanded={isExpanded}
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight">
                          {supplierNameForOrder(order)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            order.status === "open"
                              ? "bg-accent/15 text-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {order.status === "open" ? "Offen" : "Abgeschlossen"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {order.lines.length} Position{order.lines.length === 1 ? "" : "en"}
                        {deliveryLabel ? ` · Lieferung ${deliveryLabel}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Erstellt {formatWhen(order.createdAt)}
                        {(() => {
                          const creator = creatorLabelForOrder(order);
                          return creator ? ` · ${creator}` : "";
                        })()}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col justify-center gap-2 border-l border-border/50 px-2 py-2 sm:flex-row sm:items-center sm:px-3">
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
                        onClick={() => void closeOrder(order.id)}
                      >
                        Schließen
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full px-3 sm:px-4"
                        onClick={() => {
                          void reopenOrder(order.id).then((ok) => {
                            if (ok) setScope("active");
                          });
                        }}
                      >
                        Wieder öffnen
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-border/50">
                    <div className="flex flex-col gap-2 border-b border-border/40 bg-muted/20 px-4 py-3 sm:flex-row sm:items-end sm:gap-6 sm:px-5">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`delivery-${order.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Lieferdatum
                        </Label>
                        <DatePickerField
                          id={`delivery-${order.id}`}
                          size="compact"
                          disabled={order.status !== "open"}
                          value={order.deliveryDate}
                          onChange={(ymd) => void setOrderDeliveryDate(order.id, ymd)}
                          placeholder="Lieferdatum wählen"
                          className="max-w-[min(100%,12rem)]"
                        />
                      </div>
                      {order.status !== "open" ? (
                        <p className="text-xs text-muted-foreground sm:pb-2">
                          Lieferdatum ist bei abgeschlossenen Bestellungen schreibgeschützt.
                        </p>
                      ) : null}
                    </div>

                    <div className="md:hidden">
                      <PurchaseOrderMobileLinesList
                        order={order}
                        lines={sortPurchaseOrderLines(
                          order.lines,
                          ingredients,
                          ingredientCategories.items,
                          lineSortKey,
                          lineSortDir,
                        )}
                        ingredients={ingredients}
                        actor={actor}
                        onCommitQty={commitLineQty}
                        onMarkDelivered={(orderId, lineId) =>
                          void handleMarkLineDelivered(orderId, lineId)
                        }
                        onUnmarkDelivered={(orderId, lineId) =>
                          void handleUnmarkLineDelivered(orderId, lineId)
                        }
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
                                    readOnly={order.status !== "open"}
                                    actor={actor}
                                    onCommit={commitLineQty}
                                  />
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {line.unitLabel}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  {order.status === "closed" ? (
                                    line.deliveredAt ? (
                                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                          Geliefert
                                        </span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 w-fit rounded-full border-border/60 px-3 text-xs"
                                          onClick={() =>
                                            handleUnmarkLineDelivered(order.id, line.id)
                                          }
                                        >
                                          Geliefert rückgängig
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-full border-border/60 px-3 text-xs"
                                        onClick={() =>
                                          handleMarkLineDelivered(order.id, line.id)
                                        }
                                      >
                                        Als geliefert markieren
                                      </Button>
                                    )
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
        onOpenChange={(o) => {
          setProtocolOpen(o);
          if (!o) setProtocolOrderId(null);
        }}
      />
    </div>
  );
}
