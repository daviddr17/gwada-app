"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  downloadPurchaseOrdersCsv,
  downloadPurchaseOrdersPdf,
  purchaseOrdersExportLineCount,
  type PurchaseOrdersExportContext,
} from "@/lib/inventory/export-purchase-orders";

type ExportKind = "inventory" | "orders";

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

  const ordersCtx = useMemo(
    (): PurchaseOrdersExportContext => ({
      orders,
      ingredients,
    }),
    [orders, ingredients],
  );

  const restaurantName = profile.name.trim() || undefined;
  const ingredientCount = ingredients.length;
  const orderLineCount = purchaseOrdersExportLineCount(ordersCtx);

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
      <div className="mx-auto grid max-w-3xl gap-6">
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
              className="h-12 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
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
            <CardTitle>Bestellungen exportieren</CardTitle>
            <CardDescription>
              Alle Bestellungen mit Positionen (offen und abgeschlossen).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {orderLineCount > 0 ? (
                <>
                  <span className="font-medium text-foreground">
                    {orders.length}
                  </span>{" "}
                  Bestellung{orders.length === 1 ? "" : "en"} ·{" "}
                  <span className="font-medium text-foreground">
                    {orderLineCount}
                  </span>{" "}
                  Position{orderLineCount === 1 ? "" : "en"}.
                </>
              ) : (
                "Noch keine Bestellpositionen."
              )}
            </p>
            <Button
              type="button"
              className="h-12 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={orderLineCount === 0}
              onClick={() => setExportKind("orders")}
            >
              <Download className="size-4" />
              Bestellungen exportieren …
            </Button>
          </CardContent>
        </Card>
      </div>

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

      <DataExportSheet
        open={exportKind === "orders"}
        onOpenChange={(open) => {
          if (!open) setExportKind(null);
        }}
        title="Bestellungen exportieren"
        description={`${orders.length} Bestellung${orders.length === 1 ? "" : "en"} · ${orderLineCount} Position${orderLineCount === 1 ? "" : "en"}`}
        itemCount={orderLineCount}
        onCsv={() => {
          try {
            downloadPurchaseOrdersCsv(ordersCtx, { restaurantName });
            toast.success("CSV wurde heruntergeladen.");
            setExportKind(null);
          } catch {
            toast.error("CSV-Export fehlgeschlagen.");
          }
        }}
        onPdf={() => {
          void (async () => {
            try {
              await downloadPurchaseOrdersPdf(ordersCtx, { restaurantName });
              toast.success("PDF wurde heruntergeladen.");
              setExportKind(null);
            } catch {
              toast.error("PDF-Export fehlgeschlagen.");
            }
          })();
        }}
      />
    </>
  );
}
