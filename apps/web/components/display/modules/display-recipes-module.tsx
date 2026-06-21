"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
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
  recipe: RecipeLine[];
};

type CategoryChip = { id: string; name: string };

const ALL_CATEGORIES = "all";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function DisplayRecipesModule() {
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryChip[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/display/recipes", { cache: "no-store" });
      const data = (await res.json()) as {
        dishes?: Dish[];
        categories?: CategoryChip[];
      };
      setAllDishes(data.dishes ?? []);
      setCategories(data.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dishes = useMemo(() => {
    let rows = allDishes;
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
  }, [allDishes, categoryFilter, query]);

  useEffect(() => {
    if (selectedId && !dishes.some((d) => d.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dishes, selectedId]);

  const selected = useMemo(
    () => allDishes.find((d) => d.id === selectedId) ?? null,
    [allDishes, selectedId],
  );

  const categoryChip = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setCategoryFilter(id)}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        categoryFilter === id
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border/60 bg-muted/30 text-muted-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className={cn(displayModuleContentClassName, "max-w-3xl")}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gericht oder Zutat suchen …"
            className="h-14 rounded-2xl pl-11 text-lg"
          />
        </div>

        {!showSkeleton && categories.length > 0 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {categoryChip(ALL_CATEGORIES, "Alle")}
            {categories.map((c) => categoryChip(c.id, c.name))}
          </div>
        ) : null}

        {showSkeleton ? (
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
                    "transition-colors hover:border-primary/40 active:scale-[0.99]",
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
        <DrawerContent className={drawerContentClassName("formMd")}>
          {selected ? (
            <>
              <DrawerHeader className="text-left">
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

              <div className="max-h-[min(50dvh,420px)] overflow-y-auto px-6 pb-6">
                {selected.recipe.length > 0 ? (
                  <ul className="space-y-2 rounded-2xl border border-border/50 bg-muted/15 p-4">
                    {selected.recipe.map((line) => (
                      <li
                        key={line.ingredient_id}
                        className="flex items-center justify-between gap-4 text-base sm:text-lg"
                      >
                        <span className="font-medium">{line.ingredient_name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {line.amount} {line.unit}
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
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </>
  );
}
