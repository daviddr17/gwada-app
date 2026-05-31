"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  category_name: string;
  recipe: RecipeLine[];
};

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function DisplayRecipesModule() {
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q
        ? `/api/display/recipes?q=${encodeURIComponent(q)}`
        : "/api/display/recipes";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { dishes?: Dish[] };
      setDishes(data.dishes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  const selected = useMemo(
    () => dishes.find((d) => d.id === selectedId) ?? null,
    [dishes, selectedId],
  );

  if (selected) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setSelectedId(null)}
        >
          ← Zurück zur Liste
        </button>
        <div>
          <p className="text-sm text-muted-foreground">{selected.category_name}</p>
          <h2 className="text-3xl font-semibold">{selected.name}</h2>
          {selected.description ? (
            <p className="mt-2 text-muted-foreground">{selected.description}</p>
          ) : null}
          <p className="mt-2 text-xl font-medium">{eur.format(selected.price)}</p>
        </div>
        {selected.recipe.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
            <h3 className="mb-3 text-lg font-semibold">Rezept</h3>
            <ul className="space-y-2">
              {selected.recipe.map((line) => (
                <li
                  key={line.ingredient_id}
                  className="flex items-center justify-between gap-4 text-lg"
                >
                  <span>{line.ingredient_name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {line.amount} {line.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground">Kein Rezept hinterlegt.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Gericht oder Zutat suchen …"
          className="h-14 rounded-2xl pl-11 text-lg"
        />
      </div>

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
  );
}
