"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  DrawerFormBody,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { buildPurchaseOrderTableExport } from "@/lib/inventory/export-purchase-orders";
import {
  countPurchaseOrderLineExportFilters,
  DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS,
  PURCHASE_ORDER_EXPORT_FILTER_ALL,
  type PurchaseOrderLineExportFilters,
} from "@/lib/inventory/purchase-order-line-export-filters";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";

const filterSelectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

const deliveryOptions = [
  { value: PURCHASE_ORDER_EXPORT_FILTER_ALL, label: "Alle Positionen" },
  { value: "pending", label: "Noch nicht geliefert" },
  { value: "delivered", label: "Bereits geliefert" },
] as const;

type PurchaseOrderTableExportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrder;
  ingredients: Ingredient[];
  categories: InventoryTaxonomyDefinition[];
  productionSites: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  restaurantName?: string;
};

export function PurchaseOrderTableExportSheet({
  open,
  onOpenChange,
  order,
  ingredients,
  categories,
  productionSites,
  brands,
  restaurantName,
}: PurchaseOrderTableExportSheetProps) {
  const [filters, setFilters] = useState<PurchaseOrderLineExportFilters>(
    DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS,
  );

  useEffect(() => {
    if (!open) return;
    setFilters(DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS);
  }, [open, order.id]);

  const categoryOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const line of order.lines) {
      const ing = ingredients.find((i) => i.id === line.ingredientId);
      if (ing?.categoryId) ids.add(ing.categoryId);
    }
    const labelById = new Map(categories.map((c) => [c.id, c.name] as const));
    return [
      { value: PURCHASE_ORDER_EXPORT_FILTER_ALL, label: "Alle Kategorien" },
      ...[...ids]
        .map((id) => ({ value: id, label: labelById.get(id) ?? id }))
        .sort((a, b) => a.label.localeCompare(b.label, "de")),
    ];
  }, [order.lines, ingredients, categories]);

  const productionOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const line of order.lines) {
      const ing = ingredients.find((i) => i.id === line.ingredientId);
      if (ing?.productionSiteId?.trim()) ids.add(ing.productionSiteId);
    }
    const labelById = new Map(productionSites.map((s) => [s.id, s.name] as const));
    return [
      { value: PURCHASE_ORDER_EXPORT_FILTER_ALL, label: "Alle Produktionsstellen" },
      ...[...ids]
        .map((id) => ({ value: id, label: labelById.get(id) ?? id }))
        .sort((a, b) => a.label.localeCompare(b.label, "de")),
    ];
  }, [order.lines, ingredients, productionSites]);

  const brandOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const line of order.lines) {
      const ing = ingredients.find((i) => i.id === line.ingredientId);
      if (ing?.brandId?.trim()) ids.add(ing.brandId);
    }
    const labelById = new Map(brands.map((b) => [b.id, b.name] as const));
    return [
      { value: PURCHASE_ORDER_EXPORT_FILTER_ALL, label: "Alle Marken" },
      ...[...ids]
        .map((id) => ({ value: id, label: labelById.get(id) ?? id }))
        .sort((a, b) => a.label.localeCompare(b.label, "de")),
    ];
  }, [order.lines, ingredients, brands]);

  const exportOptions = useMemo(
    () =>
      buildPurchaseOrderTableExport(
        order,
        { ingredients, categories },
        filters,
      ),
    [order, ingredients, categories, filters],
  );

  const itemCount = exportOptions.rows.length;
  const activeFilterCount = countPurchaseOrderLineExportFilters(filters);

  const description =
    itemCount > 0
      ? `${order.supplierName} · ${itemCount} Position${itemCount === 1 ? "" : "en"}${
          activeFilterCount > 0 ? ` · ${activeFilterCount} Filter aktiv` : ""
        }`
      : activeFilterCount > 0
        ? "Keine Positionen für die gewählten Filter."
        : "Noch keine Positionen zum Exportieren.";

  const resetFilters = () => {
    setFilters(DEFAULT_PURCHASE_ORDER_LINE_EXPORT_FILTERS);
    toast.success("Filter zurückgesetzt");
  };

  const handleCsv = () => {
    if (itemCount === 0) return;
    try {
      downloadTableCsv({ ...exportOptions, restaurantName });
      toast.success("CSV wurde heruntergeladen.");
      onOpenChange(false);
    } catch {
      toast.error("CSV-Export fehlgeschlagen.");
    }
  };

  const handlePdf = () => {
    if (itemCount === 0) return;
    void (async () => {
      try {
        await downloadTablePdf({ ...exportOptions, restaurantName });
        toast.success("PDF wurde heruntergeladen.");
        onOpenChange(false);
      } catch {
        toast.error("PDF-Export fehlgeschlagen.");
      }
    })();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("export")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Bestellung exportieren
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Filter">
              <div className="space-y-3">
                <SearchableSelect
                  options={categoryOptions}
                  value={filters.categoryId}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, categoryId: value }))
                  }
                  placeholder="Alle Kategorien"
                  searchPlaceholder="Kategorie suchen…"
                  aria-label="Kategorie filtern"
                  className={filterSelectClassName}
                />
                <SearchableSelect
                  options={productionOptions}
                  value={filters.productionSiteId}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, productionSiteId: value }))
                  }
                  placeholder="Alle Produktionsstellen"
                  searchPlaceholder="Stelle suchen…"
                  aria-label="Produktionsstelle filtern"
                  className={filterSelectClassName}
                />
                <SearchableSelect
                  options={brandOptions}
                  value={filters.brandId}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, brandId: value }))
                  }
                  placeholder="Alle Marken"
                  searchPlaceholder="Marke suchen…"
                  aria-label="Marke filtern"
                  className={filterSelectClassName}
                />
                <SearchableSelect
                  options={[...deliveryOptions]}
                  value={filters.deliveryStatus}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      deliveryStatus: value as PurchaseOrderLineExportFilters["deliveryStatus"],
                    }))
                  }
                  placeholder="Alle Positionen"
                  searchPlaceholder="Status suchen…"
                  aria-label="Lieferstatus filtern"
                  className={filterSelectClassName}
                />
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Export">
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 justify-start gap-3 rounded-xl px-4"
                  disabled={itemCount === 0}
                  onClick={handleCsv}
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
                  className="h-12 justify-start gap-3 rounded-xl px-4"
                  disabled={itemCount === 0}
                  onClick={handlePdf}
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <span className="text-left">
                    <span className="block font-medium">Als PDF</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Tabellarische Übersicht zum Ausdrucken oder Weiterleiten
                    </span>
                  </span>
                </Button>
              </div>
            </DrawerFormSection>
          </div>

          <DrawerFilterFooter
            onReset={resetFilters}
            onDone={() => onOpenChange(false)}
            doneLabel="Schließen"
          />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
