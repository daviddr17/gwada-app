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
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

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
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Bestellungen nach Zeitraum, Lieferant und Produktionsstelle
            eingrenzen.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-2">
          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Zeitraum
            </Label>
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
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Lieferant
            </Label>
            <SearchableSelect
              options={supplierOptions}
              value={supplierFilterId}
              onValueChange={onSupplierFilterIdChange}
              placeholder="Alle Lieferanten"
              searchPlaceholder="Lieferant suchen…"
              aria-label="Nach Lieferant filtern"
              className={purchaseOrderFilterSelectClassName}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Produktionsstelle
            </Label>
            <SearchableSelect
              options={productionOptions}
              value={productionFilterId}
              onValueChange={onProductionFilterIdChange}
              placeholder="Alle Produktionsstellen"
              searchPlaceholder="Stelle suchen…"
              aria-label="Nach Produktionsstelle filtern"
              className={purchaseOrderFilterSelectClassName}
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
