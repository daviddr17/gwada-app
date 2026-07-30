"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const inventoryFilterSelectClassName = appSelectTriggerAccentCn(
  staffDrawerFieldClassName,
);

type InventoryFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterSupplier: string;
  onFilterSupplierChange: (value: string) => void;
  suppliers: InventoryTaxonomyDefinition[];
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  categories: InventoryTaxonomyDefinition[];
  filterProduction: string;
  onFilterProductionChange: (value: string) => void;
  productionSites: InventoryTaxonomyDefinition[];
  filterBrand: string;
  onFilterBrandChange: (value: string) => void;
  brands: InventoryTaxonomyDefinition[];
};

export function countInventoryActiveFilters(input: {
  filterSupplier: string;
  filterCategory: string;
  filterProduction: string;
  filterBrand: string;
}): number {
  let n = 0;
  if (input.filterSupplier !== "all") n += 1;
  if (input.filterCategory !== "all") n += 1;
  if (input.filterProduction !== "all") n += 1;
  if (input.filterBrand !== "all") n += 1;
  return n;
}

export function InventoryFilterDrawer({
  open,
  onOpenChange,
  filterSupplier,
  onFilterSupplierChange,
  suppliers,
  filterCategory,
  onFilterCategoryChange,
  categories,
  filterProduction,
  onFilterProductionChange,
  productionSites,
  filterBrand,
  onFilterBrandChange,
  brands,
}: InventoryFilterDrawerProps) {
  const supplierOptions = useMemo(
    () => [
      { value: "all", label: "Alle Lieferanten" },
      ...suppliers.map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliers],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "Alle Kategorien" },
      ...categories.map((s) => ({ value: s.id, label: s.name })),
    ],
    [categories],
  );

  const productionOptions = useMemo(
    () => [
      { value: "all", label: "Alle Produktionsstellen" },
      ...productionSites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [productionSites],
  );

  const brandOptions = useMemo(
    () => [
      { value: "all", label: "Alle Marken" },
      ...brands.map((s) => ({ value: s.id, label: s.name })),
    ],
    [brands],
  );

  const resetFilters = () => {
    onFilterSupplierChange("all");
    onFilterCategoryChange("all");
    onFilterProductionChange("all");
    onFilterBrandChange("all");
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Lieferant">
              <SearchableSelect
                options={supplierOptions}
                value={filterSupplier}
                onValueChange={onFilterSupplierChange}
                placeholder="Alle Lieferanten"
                searchPlaceholder="Lieferant suchen…"
                aria-label="Lieferant filtern"
                className={inventoryFilterSelectClassName}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Kategorie">
              <SearchableSelect
                options={categoryOptions}
                value={filterCategory}
                onValueChange={onFilterCategoryChange}
                placeholder="Alle Kategorien"
                searchPlaceholder="Kategorie suchen…"
                aria-label="Kategorie filtern"
                className={inventoryFilterSelectClassName}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Produktion">
              <SearchableSelect
                options={productionOptions}
                value={filterProduction}
                onValueChange={onFilterProductionChange}
                placeholder="Alle Produktionsstellen"
                searchPlaceholder="Stelle suchen…"
                aria-label="Produktionsstelle filtern"
                className={inventoryFilterSelectClassName}
              />
            </DrawerFilterField>
            <DrawerFilterField label="Marke">
              <SearchableSelect
                options={brandOptions}
                value={filterBrand}
                onValueChange={onFilterBrandChange}
                placeholder="Alle Marken"
                searchPlaceholder="Marke suchen…"
                aria-label="Marke filtern"
                className={inventoryFilterSelectClassName}
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
