"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
        className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Diät-Tags und Preisspanne für die aktuelle Kategorieansicht.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-2">
          <div className="space-y-3">
            <Label
              htmlFor="filter-diet-select"
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Eigenschaften
            </Label>
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
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Preisspanne
              </Label>
              <p className="text-sm font-medium tabular-nums text-foreground">
                {formatMenuPrice(lo, currencyCode)} – {formatMenuPrice(hi, currencyCode)}
              </p>
            </div>
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
          </div>
        </div>

        <Separator />

        <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={() => {
              onDietFilterChange("all");
              onPriceRangeChange([0, safeMax]);
              toast.success("Filter zurückgesetzt");
            }}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            className={cn("h-12 flex-1 ", brandActionButtonRoundedClassName)}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
