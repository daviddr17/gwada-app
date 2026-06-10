"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
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
  INVENTORY_BRANDS_KEY,
  INVENTORY_INGREDIENT_CATEGORIES_KEY,
  INVENTORY_PRODUCTION_SITES_KEY,
  INVENTORY_SUPPLIERS_KEY,
  INVENTORY_UNITS_KEY,
} from "@/lib/constants/inventory-storage";
import {
  SEED_BRANDS,
  SEED_INGREDIENT_CATEGORIES,
  SEED_PRODUCTION_SITES,
  SEED_SUPPLIERS,
  SEED_UNITS,
} from "@/lib/data/inventory-seeds";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import {
  downloadInventoryCsv,
  downloadInventoryPdf,
  type InventoryExportContext,
} from "@/lib/inventory/export-inventory";
import {
  PurchaseOrdersExportDrawer,
  purchaseOrdersWithExportLines,
} from "@/components/inventory/purchase-orders-export-drawer";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

type ExportKind = "inventory" | "orders";

function InventoryExportCardSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </SkeletonCardFrame>
  );
}

export function InventoryExportScreen() {
  const { profile } = useRestaurantProfile();
  const { ingredients, isHydrated: ingredientsReady } = useIngredientsStorage();
  const { orders, isHydrated: ordersReady } = usePurchaseOrdersStorage();
  const suppliers = useInventoryTaxonomyStorage(
    INVENTORY_SUPPLIERS_KEY,
    SEED_SUPPLIERS,
  );
  const categories = useInventoryTaxonomyStorage(
    INVENTORY_INGREDIENT_CATEGORIES_KEY,
    SEED_INGREDIENT_CATEGORIES,
  );
  const productionSites = useInventoryTaxonomyStorage(
    INVENTORY_PRODUCTION_SITES_KEY,
    SEED_PRODUCTION_SITES,
  );
  const brands = useInventoryTaxonomyStorage(
    INVENTORY_BRANDS_KEY,
    SEED_BRANDS,
  );
  const units = useInventoryTaxonomyStorage(
    INVENTORY_UNITS_KEY,
    SEED_UNITS,
  );

  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isHydrated =
    ingredientsReady &&
    ordersReady &&
    suppliers.isHydrated &&
    categories.isHydrated &&
    productionSites.isHydrated &&
    brands.isHydrated &&
    units.isHydrated;

  const inventoryCtx = useMemo(
    (): InventoryExportContext => ({
      ingredients,
      suppliers: suppliers.items,
      categories: categories.items,
      productionSites: productionSites.items,
      brands: brands.items,
      units: units.items,
    }),
    [
      ingredients,
      suppliers.items,
      categories.items,
      productionSites.items,
      brands.items,
      units.items,
    ],
  );

  const restaurantName = profile.name.trim() || undefined;
  const ingredientCount = ingredients.length;
  const exportableOrderCount = purchaseOrdersWithExportLines(orders);

  const ready = mounted && isHydrated;
  const showSkeleton = useDeferredSkeleton(!ready);

  return (
    <>
      <div className="relative mx-auto grid max-w-3xl gap-6">
        {!ready && !showSkeleton ? (
          <div className="min-h-[24rem] rounded-2xl" aria-busy />
        ) : null}
        {showSkeleton ? (
          <>
            <InventoryExportCardSkeleton />
            <InventoryExportCardSkeleton />
          </>
        ) : null}
        {ready ? (
          <>
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle>Bestand exportieren</CardTitle>
            <CardDescription>
              Zutatenliste mit leeren Spalten „Neuer Bestand“ und „Bestellung“
              zum handschriftlichen Eintragen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {ingredientCount > 0 ? (
                <>
                  <span className="font-medium text-foreground">
                    {ingredientCount}
                  </span>{" "}
                  Zutat{ingredientCount === 1 ? "" : "en"}.
                </>
              ) : (
                "Noch keine Zutaten."
              )}
            </p>
            <Button
              type="button"
              className={cn("h-12 w-full gap-2 ", brandActionButtonRoundedClassName)}
              disabled={ingredientCount === 0}
              onClick={() => setExportKind("inventory")}
            >
              <Download className="size-4" />
              Bestand exportieren …
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle>Bestellung exportieren</CardTitle>
            <CardDescription>
              Eine Bestellung aus der Liste wählen und als CSV oder PDF exportieren.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {exportableOrderCount > 0 ? (
                <>
                  <span className="font-medium text-foreground">
                    {exportableOrderCount}
                  </span>{" "}
                  Bestellung{exportableOrderCount === 1 ? "" : "en"} mit Positionen.
                </>
              ) : (
                "Noch keine Bestellungen mit Positionen."
              )}
            </p>
            <Button
              type="button"
              className={cn("h-12 w-full gap-2 ", brandActionButtonRoundedClassName)}
              disabled={exportableOrderCount === 0}
              onClick={() => setExportKind("orders")}
            >
              <Download className="size-4" />
              Bestellung exportieren …
            </Button>
          </CardContent>
        </Card>
          </>
        ) : null}
      </div>

      {ready ? (
        <>
      <DataExportSheet
        open={exportKind === "inventory"}
        onOpenChange={(open) => {
          if (!open) setExportKind(null);
        }}
        title="Bestand exportieren"
        description={`${ingredientCount} Zutat${ingredientCount === 1 ? "" : "en"}`}
        itemCount={ingredientCount}
        pdfHint="Mit Spalten zum handschriftlichen Eintragen und Seitenzahlen"
        onCsv={() => {
          try {
            downloadInventoryCsv(inventoryCtx, { restaurantName });
            toast.success("CSV wurde heruntergeladen.");
            setExportKind(null);
          } catch {
            toast.error("CSV-Export fehlgeschlagen.");
          }
        }}
        onPdf={() => {
          void (async () => {
            try {
              await downloadInventoryPdf(inventoryCtx, { restaurantName });
              toast.success("PDF wurde heruntergeladen.");
              setExportKind(null);
            } catch {
              toast.error("PDF-Export fehlgeschlagen.");
            }
          })();
        }}
      />

      <PurchaseOrdersExportDrawer
        open={exportKind === "orders"}
        onOpenChange={(open) => {
          if (!open) setExportKind(null);
        }}
        orders={orders}
        ingredients={ingredients}
        restaurantName={restaurantName}
      />
        </>
      ) : null}
    </>
  );
}
