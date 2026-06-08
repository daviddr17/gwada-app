"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
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
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Zutaten nach Lieferant, Kategorie, Produktionsstelle und Marke
            eingrenzen.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-2">
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Lieferant
            </Label>
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
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Kategorie
            </Label>
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

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Produktionsstelle
            </Label>
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
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Marke
            </Label>
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
