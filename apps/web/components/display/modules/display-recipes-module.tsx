"use client";

import { Printer, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { printDisplayRecipe } from "@/lib/display/export-display-recipe";
import { inventoryUnitLabelDe } from "@/lib/inventory/inventory-unit-label-de";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { displayFilterChipClassName } from "@/lib/ui/display-filter-chip";
import { GWADA_DISPLAY_RECIPES_REFRESH_EVENT } from "@/lib/display/display-recipes-live-events";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type RecipeLine = {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  amount: number;
};

type Dish = {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  category_name: string;
  main_category_id: string;
  recipe: RecipeLine[];
};

type CategoryChip = { id: string; name: string; main_category_id: string };
type MainCategoryChip = { id: string; name: string };

const ALL_MAIN_CATEGORIES = "all";
const ALL_CATEGORIES = "all";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function DisplayRecipesModule({
  restaurantName,
}: {
  restaurantName?: string;
}) {
  const timeZone = useDisplayRestaurantTimezone();
  const [loading, setLoading] = useState(true);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const showDataSkeleton = useDeferredSkeleton(loading && allDishes.length === 0);
  const [query, setQuery] = useState("");
  const [mainCategoryFilter, setMainCategoryFilter] = useState(ALL_MAIN_CATEGORIES);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printingRecipe, setPrintingRecipe] = useState(false);

  const [categories, setCategories] = useState<CategoryChip[]>([]);
  const [mainCategories, setMainCategories] = useState<MainCategoryChip[]>([]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/display/recipes", { cache: "no-store" });
      const data = (await res.json()) as {
        dishes?: Dish[];
        categories?: CategoryChip[];
        mainCategories?: MainCategoryChip[];
      };
      setAllDishes(data.dishes ?? []);
      setCategories(data.categories ?? []);
      setMainCategories(data.mainCategories ?? []);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      void load({ silent: true });
    };
    window.addEventListener(GWADA_DISPLAY_RECIPES_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(GWADA_DISPLAY_RECIPES_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  const visibleCategories = useMemo(() => {
    if (mainCategoryFilter === ALL_MAIN_CATEGORIES) return categories;
    return categories.filter((c) => c.main_category_id === mainCategoryFilter);
  }, [categories, mainCategoryFilter]);

  useEffect(() => {
    if (categoryFilter === ALL_CATEGORIES) return;
    if (!visibleCategories.some((c) => c.id === categoryFilter)) {
      setCategoryFilter(ALL_CATEGORIES);
    }
  }, [categoryFilter, visibleCategories]);

  const dishes = useMemo(() => {
    let rows = allDishes;
    if (mainCategoryFilter !== ALL_MAIN_CATEGORIES) {
      rows = rows.filter((d) => d.main_category_id === mainCategoryFilter);
    }
    if (categoryFilter !== ALL_CATEGORIES) {
      rows = rows.filter((d) => d.category_id === categoryFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.category_name.toLowerCase().includes(q) ||
          d.recipe.some((r) => r.ingredient_name.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [allDishes, mainCategoryFilter, categoryFilter, query]);

  useEffect(() => {
    if (selectedId && !dishes.some((d) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dishes, selectedId]);

  const selected = useMemo(
    () => allDishes.find((d) => d.id === selectedId) ?? null,
    [allDishes, selectedId],
  );

  const handlePrintRecipe = () => {
    if (!selected || selected.recipe.length === 0 || printingRecipe) return;
    void (async () => {
      setPrintingRecipe(true);
      try {
        await printDisplayRecipe(selected, { restaurantName, timeZone });
      } catch {
        toast.error("Drucken fehlgeschlagen.");
      } finally {
        setPrintingRecipe(false);
      }
    })();
  };

  const filterChip = (
    id: string,
    label: string,
    activeId: string,
    onSelect: (id: string) => void,
  ) => (
    <button
      key={id}
      type="button"
      onClick={() => onSelect(id)}
      className={displayFilterChipClassName(activeId === id)}
    >
      {label}
    </button>
  );

  const filterChipRowSkeleton = (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />
      ))}
    </div>
  );

  return (
    <>
      <div className={displayModuleContentClassName}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gericht oder Zutat suchen …"
            className="h-14 rounded-2xl pl-11 text-lg"
          />
        </div>

        {showDataSkeleton ? (
          <div className="space-y-2">
            {filterChipRowSkeleton}
            {filterChipRowSkeleton}
          </div>
        ) : (
          <div className="space-y-2">
            {mainCategories.length > 0 ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {filterChip(ALL_MAIN_CATEGORIES, "Alle", mainCategoryFilter, (id) => {
                  setMainCategoryFilter(id);
                  setCategoryFilter(ALL_CATEGORIES);
                })}
                {mainCategories.map((mc) =>
                  filterChip(mc.id, mc.name, mainCategoryFilter, (id) => {
                    setMainCategoryFilter(id);
                    setCategoryFilter(ALL_CATEGORIES);
                  }),
                )}
              </div>
            ) : null}
            {visibleCategories.length > 0 ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {filterChip(ALL_CATEGORIES, "Alle", categoryFilter, setCategoryFilter)}
                {visibleCategories.map((c) =>
                  filterChip(c.id, c.name, categoryFilter, setCategoryFilter),
                )}
              </div>
            ) : null}
          </div>
        )}

        {showDataSkeleton ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : dishes.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Keine Gerichte gefunden.
          </p>
        ) : (
          <ul className="space-y-2">
            {dishes.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card px-4 py-4 text-left shadow-card",
                    "transition-colors hover:border-accent/40 active:scale-[0.99]",
                    selectedId === d.id && "border-accent/40 bg-accent/5",
                  )}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div>
                    <p className="text-lg font-semibold">{d.name}</p>
                    <p className="text-sm text-muted-foreground">{d.category_name}</p>
                  </div>
                  <span className="text-lg tabular-nums">{eur.format(d.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Drawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("displayForm")}>
          {selected ? (
            <>
              <DrawerHeader className={drawerFormHeaderClassName(6)}>
                <p className="text-sm text-muted-foreground">{selected.category_name}</p>
                <DrawerTitle className="text-2xl font-semibold">{selected.name}</DrawerTitle>
                {selected.description ? (
                  <DrawerDescription className="text-base leading-relaxed">
                    {selected.description}
                  </DrawerDescription>
                ) : null}
                <p className="pt-1 text-xl font-medium tabular-nums">
                  {eur.format(selected.price)}
                </p>
              </DrawerHeader>

              <div className={drawerScrollAreaClassName(6)}>
                {selected.recipe.length > 0 ? (
                  <ul className="space-y-2 rounded-2xl border border-border/50 bg-muted/15 p-4">
                    {selected.recipe.map((line) => (
                      <li
                        key={line.ingredient_id}
                        className="flex items-center justify-between gap-4 text-base sm:text-lg"
                      >
                        <span className="font-medium">{line.ingredient_name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {line.amount}{" "}
                          {inventoryUnitLabelDe(line.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-muted-foreground">
                    Kein Rezept hinterlegt.
                  </p>
                )}
              </div>

              {selected.recipe.length > 0 ? (
                <div className="shrink-0 space-y-2 border-t border-border/50 px-6 py-4">
                  <Button
                    type="button"
                    className={cn("h-12 w-full gap-2", brandActionButtonRoundedClassName)}
                    disabled={printingRecipe}
                    onClick={handlePrintRecipe}
                  >
                    <Printer className="size-4" />
                    Rezept drucken
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Öffnet den System-Druckdialog mit Zutatenliste in DIN A4 Hochformat.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </>
  );
}
