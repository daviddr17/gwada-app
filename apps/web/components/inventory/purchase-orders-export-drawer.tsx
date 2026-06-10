"use client";

import { FileSpreadsheet, FileText, Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  downloadPurchaseOrdersCsv,
  downloadPurchaseOrdersPdf,
  type PurchaseOrdersExportContext,
} from "@/lib/inventory/export-purchase-orders";
import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/types/purchase-order";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFieldWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";

const filterSelectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatCreated(iso: string): string {
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDeliveryYmd(ymd: string | null): string | null {
  if (!ymd) return null;
  try {
    return dateFmt.format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

function monthKeyFromCreatedAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

function orderMatchesSearch(order: PurchaseOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (order.supplierName.toLowerCase().includes(q)) return true;
  return order.lines.some((line) =>
    line.ingredientName.toLowerCase().includes(q),
  );
}

export function countPurchaseOrderExportFilters(input: {
  supplierFilterId: string;
  statusFilter: "all" | PurchaseOrderStatus;
  createdMonthKey: string;
}): number {
  let n = 0;
  if (input.supplierFilterId !== "all") n += 1;
  if (input.statusFilter !== "all") n += 1;
  if (input.createdMonthKey !== "all") n += 1;
  return n;
}

type PurchaseOrdersExportDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: PurchaseOrder[];
  ingredients: Ingredient[];
  restaurantName?: string;
};

function PurchaseOrdersExportFilterDrawer({
  open,
  onOpenChange,
  supplierFilterId,
  onSupplierFilterIdChange,
  supplierOptions,
  statusFilter,
  onStatusFilterChange,
  createdMonthKey,
  onCreatedMonthKeyChange,
  monthOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierFilterId: string;
  onSupplierFilterIdChange: (value: string) => void;
  supplierOptions: { value: string; label: string }[];
  statusFilter: "all" | PurchaseOrderStatus;
  onStatusFilterChange: (value: "all" | PurchaseOrderStatus) => void;
  createdMonthKey: string;
  onCreatedMonthKeyChange: (value: string) => void;
  monthOptions: { value: string; label: string }[];
}) {
  const supplierSelectOptions = useMemo(
    () => [{ value: "all", label: "Alle Lieferanten" }, ...supplierOptions],
    [supplierOptions],
  );

  const statusSelectOptions = useMemo(
    () => [
      { value: "all", label: "Alle Status" },
      { value: "open", label: "Offen" },
      { value: "closed", label: "Abgeschlossen" },
    ],
    [],
  );

  const monthSelectOptions = useMemo(
    () => [{ value: "all", label: "Alle Monate" }, ...monthOptions],
    [monthOptions],
  );

  const resetFilters = () => {
    onSupplierFilterIdChange("all");
    onStatusFilterChange("all");
    onCreatedMonthKeyChange("all");
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,520px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Liste nach Lieferant, Status und Erstellungsmonat eingrenzen.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-2">
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Lieferant
            </Label>
            <SearchableSelect
              options={supplierSelectOptions}
              value={supplierFilterId}
              onValueChange={onSupplierFilterIdChange}
              placeholder="Alle Lieferanten"
              searchPlaceholder="Lieferant suchen…"
              aria-label="Lieferant filtern"
              className={filterSelectClassName}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Status
            </Label>
            <SearchableSelect
              options={statusSelectOptions}
              value={statusFilter}
              onValueChange={(v) => {
                if (v === "all" || v === "open" || v === "closed") {
                  onStatusFilterChange(v);
                }
              }}
              placeholder="Alle Status"
              searchPlaceholder="Status suchen…"
              aria-label="Status filtern"
              className={filterSelectClassName}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Erstellt im Monat
            </Label>
            <SearchableSelect
              options={monthSelectOptions}
              value={createdMonthKey}
              onValueChange={onCreatedMonthKeyChange}
              placeholder="Alle Monate"
              searchPlaceholder="Monat suchen…"
              aria-label="Erstellungsmonat filtern"
              className={filterSelectClassName}
            />
          </div>
        </div>

        <Separator />

        <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={resetFilters}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            className={cn("h-12 flex-1", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function PurchaseOrdersExportDrawer({
  open,
  onOpenChange,
  orders,
  ingredients,
  restaurantName,
}: PurchaseOrdersExportDrawerProps) {
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [supplierFilterId, setSupplierFilterId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrderStatus>("all");
  const [createdMonthKey, setCreatedMonthKey] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSupplierFilterId("all");
      setStatusFilter("all");
      setCreatedMonthKey("all");
      setSelectedOrderId(null);
      setFilterOpen(false);
    }
  }, [open]);

  const supplierOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const o of orders) {
      byId.set(o.supplierId, o.supplierName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "de"))
      .map(([value, label]) => ({ value, label }));
  }, [orders]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const o of orders) {
      keys.add(monthKeyFromCreatedAt(o.createdAt));
    }
    return [...keys]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: formatMonthLabel(value) }));
  }, [orders]);

  const filterActiveCount = useMemo(
    () =>
      countPurchaseOrderExportFilters({
        supplierFilterId,
        statusFilter,
        createdMonthKey,
      }),
    [createdMonthKey, statusFilter, supplierFilterId],
  );

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => o.lines.length > 0)
      .filter((o) => supplierFilterId === "all" || o.supplierId === supplierFilterId)
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter(
        (o) =>
          createdMonthKey === "all" ||
          monthKeyFromCreatedAt(o.createdAt) === createdMonthKey,
      )
      .filter((o) => orderMatchesSearch(o, search))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, supplierFilterId, statusFilter, createdMonthKey, search]);

  useEffect(() => {
    if (
      selectedOrderId &&
      !filteredOrders.some((o) => o.id === selectedOrderId)
    ) {
      setSelectedOrderId(null);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((o) => o.id === selectedOrderId) ?? null,
    [filteredOrders, selectedOrderId],
  );

  const selectedLineCount = selectedOrder?.lines.length ?? 0;

  const exportSelected = (format: "csv" | "pdf") => {
    if (!selectedOrder) return;
    const ctx: PurchaseOrdersExportContext = {
      orders: [selectedOrder],
      ingredients,
    };
    try {
      if (format === "csv") {
        downloadPurchaseOrdersCsv(ctx, { restaurantName });
        toast.success("CSV wurde heruntergeladen.");
      } else {
        void downloadPurchaseOrdersPdf(ctx, { restaurantName }).then(() => {
          toast.success("PDF wurde heruntergeladen.");
        });
      }
      onOpenChange(false);
    } catch {
      toast.error(
        format === "csv" ? "CSV-Export fehlgeschlagen." : "PDF-Export fehlgeschlagen.",
      );
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Bestellung exportieren
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Bestellung aus der Liste wählen, dann als CSV oder PDF exportieren.
            </DrawerDescription>
          </DrawerHeader>

          <div className="shrink-0 space-y-3 px-6 pb-3">
            <div className={moduleSearchFilterRowClassName}>
              <div className={moduleSearchFieldWrapClassName}>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Lieferant oder Zutat …"
                  className={moduleSearchInputClassName}
                  aria-label="Bestellungen durchsuchen"
                />
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
            <p className="text-xs text-muted-foreground">
              {filteredOrders.length} Bestellung
              {filteredOrders.length === 1 ? "" : "en"}
              {search.trim() || filterActiveCount > 0 ? " (gefiltert)" : ""}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2">
            {filteredOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                Keine Bestellungen für Suche oder Filter.
              </div>
            ) : (
              <ul className="space-y-2 pb-2" role="listbox" aria-label="Bestellungen">
                {filteredOrders.map((order) => {
                  const selected = selectedOrderId === order.id;
                  const deliveryLabel = formatDeliveryYmd(order.deliveryDate);
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
                          selected
                            ? "border-ring ring-2 ring-ring/30 bg-muted/40"
                            : "border-border/50 hover:border-border hover:bg-muted/30",
                        )}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {order.supplierName}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              order.status === "open"
                                ? "bg-muted text-foreground"
                                : "bg-muted/60 text-muted-foreground",
                            )}
                          >
                            {order.status === "open" ? "Offen" : "Abgeschlossen"}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Erstellt {formatCreated(order.createdAt)}
                          {deliveryLabel ? ` · Lieferung ${deliveryLabel}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {order.lines.length} Position
                          {order.lines.length === 1 ? "" : "en"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Separator />

          <div className="shrink-0 space-y-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {selectedOrder ? (
              <p className="text-sm text-muted-foreground">
                Ausgewählt:{" "}
                <span className="font-medium text-foreground">
                  {selectedOrder.supplierName}
                </span>{" "}
                · {selectedLineCount} Position
                {selectedLineCount === 1 ? "" : "en"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Bitte eine Bestellung aus der Liste wählen.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start gap-3 rounded-xl px-4"
              disabled={!selectedOrder}
              onClick={() => exportSelected("csv")}
            >
              <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
              <span className="text-left">
                <span className="block font-medium">Als CSV</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Für Excel, Numbers oder weitere Auswertung
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start gap-3 rounded-xl px-4"
              disabled={!selectedOrder}
              onClick={() => exportSelected("pdf")}
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <span className="text-left">
                <span className="block font-medium">Als PDF</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Tabellarische Übersicht mit Seitenzahlen
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <PurchaseOrdersExportFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        supplierFilterId={supplierFilterId}
        onSupplierFilterIdChange={setSupplierFilterId}
        supplierOptions={supplierOptions}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        createdMonthKey={createdMonthKey}
        onCreatedMonthKeyChange={setCreatedMonthKey}
        monthOptions={monthOptions}
      />
    </>
  );
}

export function purchaseOrdersWithExportLines(orders: PurchaseOrder[]): number {
  return orders.filter((o) => o.lines.length > 0).length;
}
