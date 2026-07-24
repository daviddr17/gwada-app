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
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const purchaseOrderFilterSelectClassName = appSelectTriggerAccentCn(
  staffDrawerFieldClassName,
);

const scopeItems = {
  active: "Aktive Bestellungen",
  past: "Vergangene Bestellungen",
} as const;

export type PurchaseOrderScope = keyof typeof scopeItems;

type PurchaseOrdersFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: PurchaseOrderScope;
  onScopeChange: (scope: PurchaseOrderScope) => void;
  supplierFilterId: string;
  onSupplierFilterIdChange: (value: string) => void;
  supplierFilterOptions: { value: string; label: string }[];
  productionFilterId: string;
  onProductionFilterIdChange: (value: string) => void;
  productionFilterOptions: { value: string; label: string }[];
};

export function countPurchaseOrderActiveFilters(input: {
  scope: PurchaseOrderScope;
  supplierFilterId: string;
  productionFilterId: string;
}): number {
  let n = 0;
  if (input.scope !== "active") n += 1;
  if (input.supplierFilterId !== "all") n += 1;
  if (input.productionFilterId !== "all") n += 1;
  return n;
}

export function PurchaseOrdersFilterDrawer({
  open,
  onOpenChange,
  scope,
  onScopeChange,
  supplierFilterId,
  onSupplierFilterIdChange,
  supplierFilterOptions,
  productionFilterId,
  onProductionFilterIdChange,
  productionFilterOptions,
}: PurchaseOrdersFilterDrawerProps) {
  const supplierOptions = useMemo(
    () => [
      { value: "all", label: "Alle Lieferanten" },
      ...supplierFilterOptions,
    ],
    [supplierFilterOptions],
  );

  const productionOptions = useMemo(
    () => [
      { value: "all", label: "Alle Produktionsstellen" },
      ...productionFilterOptions,
    ],
    [productionFilterOptions],
  );

  const scopeOptions = useMemo(
    () => [
      { value: "active", label: scopeItems.active },
      { value: "past", label: scopeItems.past },
    ],
    [],
  );

  const resetFilters = () => {
    onScopeChange("active");
    onSupplierFilterIdChange("all");
    onProductionFilterIdChange("all");
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Zeitraum">
              <SearchableSelect
                options={scopeOptions}
                value={scope}
                onValueChange={(v) => {
                  if (v === "active" || v === "past") onScopeChange(v);
                }}
                placeholder="Zeitraum"
                searchPlaceholder="Zeitraum suchen…"
                aria-label="Aktive oder vergangene Bestellungen filtern"
                className={purchaseOrderFilterSelectClassName}
              />
            </DrawerFilterField>

            <DrawerFilterField label="Lieferant">
              <SearchableSelect
                options={supplierOptions}
                value={supplierFilterId}
                onValueChange={onSupplierFilterIdChange}
                placeholder="Alle Lieferanten"
                searchPlaceholder="Lieferant suchen…"
                aria-label="Nach Lieferant filtern"
                className={purchaseOrderFilterSelectClassName}
              />
            </DrawerFilterField>

            <DrawerFilterField label="Produktion">
              <SearchableSelect
                options={productionOptions}
                value={productionFilterId}
                onValueChange={onProductionFilterIdChange}
                placeholder="Alle Produktionsstellen"
                searchPlaceholder="Stelle suchen…"
                aria-label="Nach Produktionsstelle filtern"
                className={purchaseOrderFilterSelectClassName}
              />
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
