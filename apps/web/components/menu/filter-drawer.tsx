"use client";

import { toast } from "sonner";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import type { DietFilter, PriceRange } from "@/lib/types/menu";

type FilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dietOptions: { value: DietFilter; label: string }[];
  dietFilter: DietFilter;
  onDietFilterChange: (v: DietFilter) => void;
  priceRange: PriceRange;
  onPriceRangeChange: (r: PriceRange) => void;
  /** Oberes Ende des Sliders – aus Menüpreisen abgeleitet */
  priceMax: number;
  currencyCode?: string;
};

export function FilterDrawer({
  open,
  onOpenChange,
  dietOptions,
  dietFilter,
  onDietFilterChange,
  priceRange,
  onPriceRangeChange,
  priceMax,
  currencyCode,
}: FilterDrawerProps) {
  const safeMax = Math.max(priceMax, 1);
  const [lo, hi] = priceRange;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent
        className={drawerContentClassName("template")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Diät-Tags und Preisspanne für die aktuelle Kategorieansicht.
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection title="Eigenschaften">
            <Select
              value={dietFilter}
              items={Object.fromEntries(
                dietOptions.map(({ value, label }) => [value, label]),
              )}
              onValueChange={(v) => {
                if (typeof v === "string")
                  onDietFilterChange(v as DietFilter);
              }}
            >
              <SelectTrigger
                id="filter-diet-select"
                className="h-12 w-full rounded-2xl text-left text-base font-medium"
              >
                <SelectValue placeholder="Eigenschaft wählen" />
              </SelectTrigger>
              <SelectContent>
                {dietOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Filtert Gerichte nach Ernährungsmerkmalen in der aktuellen Ansicht.
            </p>
          </DrawerFormSection>

          <DrawerFormSection title="Preisspanne">
            <p className="text-sm font-medium tabular-nums text-foreground">
              {formatMenuPrice(lo, currencyCode)} – {formatMenuPrice(hi, currencyCode)}
            </p>
            <Slider
              value={[Math.min(lo, hi), Math.max(lo, hi)]}
              onValueChange={(v) => {
                const vals = Array.isArray(v) ? [...v] : [v, v];
                const a = Math.max(0, Math.min(vals[0], vals[1]));
                const b = Math.min(safeMax, Math.max(vals[0], vals[1]));
                onPriceRangeChange([a, b] as PriceRange);
              }}
              min={0}
              max={safeMax}
              step={0.5}
              minStepsBetweenValues={0}
              className="w-full py-2"
            />
            <p className="text-xs text-muted-foreground">
              Von 0 bis {formatMenuPrice(safeMax, currencyCode)} (abhängig von den höchsten Preisen in der Karte)
            </p>
          </DrawerFormSection>
        </div>

        <DrawerFilterFooter
          onReset={() => {
            onDietFilterChange("all");
            onPriceRangeChange([0, safeMax]);
            toast.success("Filter zurückgesetzt");
          }}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
