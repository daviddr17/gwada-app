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
import { Input } from "@/components/ui/input";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  buildInventoryTableExportOptions,
  type InventoryExportContext,
} from "@/lib/inventory/export-inventory";
import {
  countInventoryTableExportFilters,
  DEFAULT_INVENTORY_TABLE_EXPORT_FILTERS,
  INVENTORY_EXPORT_FILTER_ALL,
  type InventoryTableExportFilters,
} from "@/lib/inventory/inventory-table-export-filters";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type { MenuItem } from "@/lib/types/menu";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import { cn } from "@/lib/utils";

const filterSelectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type InventoryTableExportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  suppliers: InventoryTaxonomyDefinition[];
  categories: InventoryTaxonomyDefinition[];
  productionSites: InventoryTaxonomyDefinition[];
  brands: InventoryTaxonomyDefinition[];
  units: InventoryTaxonomyDefinition[];
  menuItems: MenuItem[];
  restaurantName?: string;
  initialFilters?: Partial<InventoryTableExportFilters>;
  initialSearch?: string;
};

export function InventoryTableExportSheet({
  open,
  onOpenChange,
  ingredients,
  suppliers,
  categories,
  productionSites,
  brands,
  units,
  menuItems,
  restaurantName,
  initialFilters,
  initialSearch = "",
}: InventoryTableExportSheetProps) {
  const [filters, setFilters] = useState<InventoryTableExportFilters>(
    DEFAULT_INVENTORY_TABLE_EXPORT_FILTERS,
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilters({
      ...DEFAULT_INVENTORY_TABLE_EXPORT_FILTERS,
      ...initialFilters,
    });
    setSearch(initialSearch.trim());
  }, [open, initialFilters, initialSearch]);

  const supplierOptions = useMemo(
    () => [
      { value: INVENTORY_EXPORT_FILTER_ALL, label: "Alle Lieferanten" },
      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers],
  );

  const categoryOptions = useMemo(
    () => [
      { value: INVENTORY_EXPORT_FILTER_ALL, label: "Alle Kategorien" },
      ...categories.map((s) => ({ value: s.id, label: s.name })),
    ],
    [categories],
  );

  const productionOptions = useMemo(
    () => [
      { value: INVENTORY_EXPORT_FILTER_ALL, label: "Alle Produktionsstellen" },
      ...productionSites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [productionSites],
  );

  const brandOptions = useMemo(
    () => [
      { value: INVENTORY_EXPORT_FILTER_ALL, label: "Alle Marken" },
      ...brands.map((s) => ({ value: s.id, label: s.name })),
    ],
    [brands],
  );

  const exportCtx = useMemo(
    (): Omit<InventoryExportContext, "ingredients"> => ({
      suppliers,
      categories,
      productionSites,
      brands,
      units,
    }),
    [suppliers, categories, productionSites, brands, units],
  );

  const exportOptions = useMemo(
    () =>
      buildInventoryTableExportOptions(ingredients, filters, exportCtx, {
        search,
        menuItems,
      }),
    [ingredients, filters, exportCtx, search, menuItems],
  );

  const itemCount = exportOptions.rows.length;
  const activeFilterCount = countInventoryTableExportFilters(filters);
  const hasSearch = search.trim().length > 0;

  const description =
    itemCount > 0
      ? `${itemCount} Zutat${itemCount === 1 ? "" : "en"}${
          activeFilterCount > 0 || hasSearch
            ? ` · ${activeFilterCount + (hasSearch ? 1 : 0)} Filter aktiv`
            : ""
        }`
      : activeFilterCount > 0 || hasSearch
        ? "Keine Zutaten für die gewählten Filter."
        : "Noch keine Zutaten zum Exportieren.";

  const resetFilters = () => {
    setFilters(DEFAULT_INVENTORY_TABLE_EXPORT_FILTERS);
    setSearch("");
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
        await downloadTablePdf({
          ...exportOptions,
          restaurantName,
          summaryLine: `${exportOptions.summaryLine} · Spalten „Neuer Bestand“ und „Bestellung“ zum handschriftlichen Eintragen`,
        });
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
            Bestand exportieren
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Filter">
              <div className="space-y-3">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Zutaten suchen…"
                  aria-label="Zutaten suchen"
                  className={cn(staffDrawerFieldClassName, "h-11")}
                />
                <SearchableSelect
                  options={supplierOptions}
                  value={filters.supplierId}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, supplierId: value }))
                  }
                  placeholder="Alle Lieferanten"
                  searchPlaceholder="Lieferant suchen…"
                  aria-label="Lieferant filtern"
                  className={filterSelectClassName}
                />
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
                      Tabellarische Übersicht mit Spalten zum handschriftlichen Eintragen
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
