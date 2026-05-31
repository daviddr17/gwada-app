"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { MenuExportSheet } from "@/components/menu/menu-export-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MENU_TAXONOMY_ALLERGENS_KEY,
  MENU_TAXONOMY_TAGS_KEY,
  SEED_MENU_ALLERGEN_DEFINITIONS,
  SEED_MENU_TAG_DEFINITIONS,
} from "@/lib/constants/menu-taxonomy-storage";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useCategoriesStorage } from "@/lib/hooks/use-categories-storage";
import { useMenuTaxonomyStorage } from "@/lib/hooks/use-menu-taxonomy-storage";
import { useMenuStorage } from "@/lib/hooks/use-menu-storage";
import { menuExportTotals } from "@/lib/menu/export-menu";

export function MenuExportScreen() {
  const { profile } = useRestaurantProfile();
  const { categories, isHydrated: categoriesReady } = useCategoriesStorage();
  const { items, isHydrated: menuReady } = useMenuStorage();
  const menuTags = useMenuTaxonomyStorage(
    MENU_TAXONOMY_TAGS_KEY,
    SEED_MENU_TAG_DEFINITIONS,
  );
  const menuAllergens = useMenuTaxonomyStorage(
    MENU_TAXONOMY_ALLERGENS_KEY,
    SEED_MENU_ALLERGEN_DEFINITIONS,
  );

  const [exportOpen, setExportOpen] = useState(false);

  const isHydrated =
    categoriesReady &&
    menuReady &&
    menuTags.isHydrated &&
    menuAllergens.isHydrated;

  const tagDefinitions = useMemo(
    () => [...menuTags.items, ...menuAllergens.items],
    [menuTags.items, menuAllergens.items],
  );

  const exportContext = useMemo(
    () => ({
      categories,
      items,
      tagDefinitions,
    }),
    [categories, items, tagDefinitions],
  );

  const { dishCount, categoryCount } = menuExportTotals(exportContext);
  const restaurantName = profile.name.trim() || undefined;

  if (!isHydrated) {
    return (
      <div
        className="min-h-[12rem] rounded-2xl border border-border/50 bg-card/50"
        aria-busy
      />
    );
  }

  return (
    <>
      <Card className="mx-auto max-w-lg border-border/50 shadow-card">
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Gesamte Speisekarte als CSV oder PDF — alle Kategorien und Gerichte
            (inkl. inaktiver Einträge).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {dishCount > 0 ? (
              <>
                <span className="font-medium text-foreground">{dishCount}</span>{" "}
                Gericht{dishCount === 1 ? "" : "e"} in{" "}
                <span className="font-medium text-foreground">
                  {categoryCount}
                </span>{" "}
                Kategorie{categoryCount === 1 ? "" : "n"}.
              </>
            ) : (
              "Noch keine Gerichte zum Exportieren."
            )}
          </p>
          <Button
            type="button"
            className="h-12 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={dishCount === 0}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" />
            Exportieren …
          </Button>
        </CardContent>
      </Card>

      <MenuExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        exportContext={exportContext}
        restaurantName={restaurantName}
      />
    </>
  );
}
