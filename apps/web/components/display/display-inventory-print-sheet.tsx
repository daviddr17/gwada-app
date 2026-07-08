"use client";

import { Printer } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type {
  DisplayInventoryFilterOption,
  DisplayInventoryIngredientRow,
} from "@/lib/display/display-inventory-server";
import {
  countDisplayInventoryExportFilters,
  DEFAULT_DISPLAY_INVENTORY_EXPORT_FILTERS,
  filterDisplayInventoryExportRows,
  printDisplayInventory,
  type DisplayInventoryExportFilters,
  type DisplayInventoryExportMode,
} from "@/lib/display/export-display-inventory";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";

const ALL = "all";

const filterSelectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

function deriveBrandOptions(
  rows: DisplayInventoryIngredientRow[],
): DisplayInventoryFilterOption[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.brandId) continue;
    map.set(row.brandId, row.brandLabel || row.brandId);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

type DisplayInventoryPrintSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DisplayInventoryExportMode;
  ingredients: DisplayInventoryIngredientRow[];
  suppliers: DisplayInventoryFilterOption[];
  categories: DisplayInventoryFilterOption[];
  productionSites: DisplayInventoryFilterOption[];
  restaurantName?: string;
  initialFilters?: Partial<DisplayInventoryExportFilters>;
};

export function DisplayInventoryPrintSheet({
  open,
  onOpenChange,
  mode,
  ingredients,
  suppliers,
  categories,
  productionSites,
  restaurantName,
  initialFilters,
}: DisplayInventoryPrintSheetProps) {
  const [filters, setFilters] = useState<DisplayInventoryExportFilters>(
    DEFAULT_DISPLAY_INVENTORY_EXPORT_FILTERS,
  );

  useEffect(() => {
    if (!open) return;
    setFilters({
      ...DEFAULT_DISPLAY_INVENTORY_EXPORT_FILTERS,
      ...initialFilters,
    });
  }, [open, initialFilters]);

  const brands = useMemo(() => deriveBrandOptions(ingredients), [ingredients]);

  const supplierOptions = useMemo(
    () => [
      { value: ALL, label: "Alle Lieferanten" },
      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers],
  );

  const categoryOptions = useMemo(
    () => [
      { value: ALL, label: "Alle Kategorien" },
      ...categories.map((s) => ({ value: s.id, label: s.name })),
    ],
    [categories],
  );

  const productionOptions = useMemo(
    () => [
      { value: ALL, label: "Alle Produktionsstellen" },
      ...productionSites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [productionSites],
  );

  const brandOptions = useMemo(
    () => [
      { value: ALL, label: "Alle Marken" },
      ...brands.map((s) => ({ value: s.id, label: s.name })),
    ],
    [brands],
  );

  const filteredRows = useMemo(
    () => filterDisplayInventoryExportRows(ingredients, filters, mode),
    [ingredients, filters, mode],
  );

  const activeFilterCount = countDisplayInventoryExportFilters(filters, mode);
  const isStock = mode === "stock";
  const title = isStock ? "Bestand drucken" : "Bestellung drucken";
  const description =
    filteredRows.length > 0
      ? `${filteredRows.length} Zutat${filteredRows.length === 1 ? "" : "en"}${
          activeFilterCount > 0 ? ` · ${activeFilterCount} Filter aktiv` : ""
        }`
      : activeFilterCount > 0
        ? "Keine Zutaten für die gewählten Filter."
        : "Noch keine Zutaten zum Drucken.";

  const resetFilters = () => {
    setFilters(DEFAULT_DISPLAY_INVENTORY_EXPORT_FILTERS);
    toast.success("Filter zurückgesetzt");
  };

  const handlePrint = () => {
    if (filteredRows.length === 0) return;
    void (async () => {
      try {
        await printDisplayInventory(filteredRows, mode, { restaurantName });
        onOpenChange(false);
      } catch {
        toast.error("Drucken fehlgeschlagen.");
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
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Filter">
              <div className="space-y-3">
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

            {!isStock ? (
              <DrawerFormSection title="Bestellmenge">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <Label htmlFor="display-print-only-order-qty" className="text-sm">
                      Nur mit Bestellmenge
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Positionen mit Menge größer als 0
                    </p>
                  </div>
                  <Switch
                    id="display-print-only-order-qty"
                    checked={filters.onlyWithOrderQuantity}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        onlyWithOrderQuantity: checked,
                      }))
                    }
                  />
                </div>
              </DrawerFormSection>
            ) : null}

            <DrawerFormSection title="Drucken">
              <Button
                type="button"
                className={cn(
                  "h-12 w-full gap-2",
                  brandActionButtonRoundedClassName,
                )}
                disabled={filteredRows.length === 0}
                onClick={handlePrint}
              >
                <Printer className="size-4" />
                Jetzt drucken
              </Button>
              <p className="text-xs text-muted-foreground">
                {isStock
                  ? "Öffnet den System-Druckdialog in DIN A4 Querformat mit Spalten zum handschriftlichen Eintragen."
                  : "Öffnet den System-Druckdialog in DIN A4 Querformat mit der gefilterten Bestellliste."}
              </p>
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
