"use client";

import { useQuery } from "@tanstack/react-query";
import {
  foodMarkingsForCountry,
  type FoodMarkingDefinition,
} from "@/lib/menu/food-marking-catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { normalizeCountryIso2 } from "@/lib/restaurant/country-profile";

async function loadFoodMarkingsFromDb(
  countryIso2: string,
): Promise<FoodMarkingDefinition[] | null> {
  try {
    const sb = createSupabaseBrowserClient();
    const { data, error } = await sb
      .from("platform_food_marking_codes")
      .select("code, kind, short_label, label, sort_order")
      .eq("country_code", countryIso2)
      .eq("is_active", true)
      .order("sort_order")
      .order("code");

    if (error || !data || data.length === 0) return null;

    return data.map((row) => ({
      code: String(row.code),
      kind:
        row.kind === "allergen" ? ("allergen" as const) : ("additive" as const),
      shortLabel: String(row.short_label ?? row.code),
      label: String(row.label ?? row.code),
    }));
  } catch {
    return null;
  }
}

export function useFoodMarkingsCatalog(
  countryIso2: string | null | undefined,
) {
  const country = normalizeCountryIso2(countryIso2);
  const seed = foodMarkingsForCountry(country);

  const query = useQuery({
    queryKey: ["platform-food-markings", country],
    queryFn: async () => {
      const fromDb = await loadFoodMarkingsFromDb(country);
      return fromDb ?? seed;
    },
    placeholderData: seed,
    staleTime: 60_000,
  });

  const definitions = query.data ?? seed;
  const taxonomy = foodMarkingsAsTaxonomyFromDefinitions(definitions);

  return {
    country,
    definitions,
    taxonomy,
    isLoading: query.isLoading && !query.data,
  };
}

function foodMarkingsAsTaxonomyFromDefinitions(
  definitions: FoodMarkingDefinition[],
): { id: string; name: string; active: true; backgroundColor: string }[] {
  return definitions.map((m) => ({
    id: m.code,
    name: `${m.shortLabel} · ${m.label}`,
    active: true as const,
    backgroundColor: m.kind === "allergen" ? "#fef3c7" : "#e0f2fe",
  }));
}
