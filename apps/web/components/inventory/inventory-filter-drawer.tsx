"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
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
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Separator } from "@/components/ui/separator";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

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
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Zutaten nach Lieferant, Kategorie, Produktionsstelle und Marke
            eingrenzen.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection title="Lieferant & Kategorie">
            <div className="space-y-3">
              <SearchableSelect
              options={supplierOptions}
              value={filterSupplier}
              onValueChange={onFilterSupplierChange}
              placeholder="Alle Lieferanten"
              searchPlaceholder="Lieferant suchen…"
              aria-label="Lieferant filtern"
              className={inventoryFilterSelectClassName}
            />
            </div>
            <div className="space-y-3">
              <SearchableSelect
                options={categoryOptions}
                value={filterCategory}
                onValueChange={onFilterCategoryChange}
                placeholder="Alle Kategorien"
                searchPlaceholder="Kategorie suchen…"
                aria-label="Kategorie filtern"
                className={inventoryFilterSelectClassName}
              />
            </div>
          </DrawerFormSection>

          <DrawerFormSection title="Produktion & Marke">
            <div className="space-y-3">
              <SearchableSelect
              options={productionOptions}
              value={filterProduction}
              onValueChange={onFilterProductionChange}
              placeholder="Alle Produktionsstellen"
              searchPlaceholder="Stelle suchen…"
              aria-label="Produktionsstelle filtern"
              className={inventoryFilterSelectClassName}
            />
            </div>
            <div className="space-y-3">
              <SearchableSelect
                options={brandOptions}
                value={filterBrand}
                onValueChange={onFilterBrandChange}
                placeholder="Alle Marken"
                searchPlaceholder="Marke suchen…"
                aria-label="Marke filtern"
                className={inventoryFilterSelectClassName}
              />
            </div>
          </DrawerFormSection>
        </div>
        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
