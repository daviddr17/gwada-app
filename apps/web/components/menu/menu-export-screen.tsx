"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { MenuExportSheet } from "@/components/menu/menu-export-sheet";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
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
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

function MenuExportCardSkeleton() {
  return (
    <SkeletonCardFrame className="mx-auto max-w-lg space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </SkeletonCardFrame>
  );
}

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const ready = mounted && isHydrated;
  const showSkeleton = useDeferredSkeleton(!ready);

  return (
    <>
      <div className="relative mx-auto max-w-lg">
        {!ready && !showSkeleton ? (
          <div className="min-h-[14rem] rounded-2xl" aria-busy />
        ) : null}
        {showSkeleton ? <MenuExportCardSkeleton /> : null}
        {ready ? (
          <Card className="border-border/50 shadow-card">
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
            className={cn("h-12 w-full gap-2 ", brandActionButtonRoundedClassName)}
            disabled={dishCount === 0}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" />
            Exportieren …
          </Button>
        </CardContent>
      </Card>
        ) : null}
      </div>

      {ready ? (
      <MenuExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        exportContext={exportContext}
        restaurantName={restaurantName}
      />
      ) : null}
    </>
  );
}
