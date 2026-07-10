"use client";

import { useMemo } from "react";
import { ShoppingCart, X } from "lucide-react";
import { AppFullscreenOverlay } from "@/components/ui/app-fullscreen-overlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DisplayInventoryIngredientRow } from "@/lib/display/display-inventory-server";
import { appFullscreenOverlayScrollClassName } from "@/components/ui/app-fullscreen-overlay";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  moduleDataTableHeadRowNormalCaseClassName,
  moduleDataTableShellClassName,
} from "@/lib/ui/module-data-table";
import { ModuleTableHorizontalScrollRegion } from "@/lib/ui/module-table-sticky-column";
import { cn } from "@/lib/utils";

const ORDER_TABLE_HEADERS = [
  "Zutat",
  "Marke",
  "Bestand",
  "Menge",
  "Einheit",
  "Kategorie",
  "Produktion",
] as const;

export function displayInventoryOrderCartLines(
  ingredients: DisplayInventoryIngredientRow[],
): DisplayInventoryIngredientRow[] {
  return ingredients
    .filter((row) => row.orderLineId && row.orderQuantity > 0)
    .sort((a, b) => {
      const bySupplier = a.supplierName.localeCompare(b.supplierName, "de");
      if (bySupplier !== 0) return bySupplier;
      return a.name.localeCompare(b.name, "de");
    });
}

function groupOrderCartBySupplier(
  lines: DisplayInventoryIngredientRow[],
): Array<{ supplierId: string; supplierName: string; lines: DisplayInventoryIngredientRow[] }> {
  const map = new Map<
    string,
    { supplierId: string; supplierName: string; lines: DisplayInventoryIngredientRow[] }
  >();
  for (const row of lines) {
    const existing = map.get(row.supplierId);
    if (existing) {
      existing.lines.push(row);
      continue;
    }
    map.set(row.supplierId, {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      lines: [row],
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "de"),
  );
}

type DisplayInventoryOrderCartOverlayProps = {
  open: boolean;
  onClose: () => void;
  ingredients: DisplayInventoryIngredientRow[];
  restaurantName?: string;
};

export function DisplayInventoryOrderCartOverlay({
  open,
  onClose,
  ingredients,
  restaurantName,
}: DisplayInventoryOrderCartOverlayProps) {
  const cartLines = useMemo(
    () => displayInventoryOrderCartLines(ingredients),
    [ingredients],
  );
  const supplierGroups = useMemo(
    () => groupOrderCartBySupplier(cartLines),
    [cartLines],
  );
  const positionCount = cartLines.length;
  const supplierCount = supplierGroups.length;

  return (
    <AppFullscreenOverlay
      open={open}
      onClose={onClose}
      aria-label="Aktuelle Bestellung"
      header={
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-xl"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">Aktuelle Bestellung</p>
            <p className="truncate text-sm text-muted-foreground">
              {positionCount > 0
                ? `${positionCount} Position${positionCount === 1 ? "" : "en"} · ${supplierCount} Lieferant${supplierCount === 1 ? "" : "en"}`
                : "Noch keine Positionen"}
              {restaurantName?.trim() ? ` · ${restaurantName.trim()}` : ""}
            </p>
          </div>
          <ShoppingCart className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
      }
      footer={
        <div className="px-4 py-3">
          <Button
            type="button"
            className={cn(brandActionButtonRoundedClassName, "h-11 w-full")}
            onClick={onClose}
          >
            Fertig
          </Button>
        </div>
      }
    >
      <div className={cn(appFullscreenOverlayScrollClassName, "px-4 py-4")}>
        {positionCount === 0 ? (
          <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 px-6 text-center">
            <ShoppingCart className="size-10 text-muted-foreground/50" aria-hidden />
            <p className="text-base font-medium text-foreground">
              Die Bestellung ist noch leer
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Positionen erscheinen hier, sobald du Bestellmengen bei den Zutaten
              eingibst.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {supplierGroups.map((group) => (
              <section key={group.supplierId} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {group.supplierName}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {group.lines.length} Position
                    {group.lines.length === 1 ? "" : "en"}
                  </p>
                </div>
                <div className={moduleDataTableShellClassName}>
                  <ModuleTableHorizontalScrollRegion>
                    <table className="w-full min-w-[36rem] border-collapse text-sm">
                      <thead>
                        <tr className={moduleDataTableHeadRowNormalCaseClassName}>
                          {ORDER_TABLE_HEADERS.map((header) => (
                            <th
                              key={header}
                              className={cn(
                                "px-3 py-2.5 text-left font-medium whitespace-nowrap",
                                (header === "Bestand" || header === "Menge") &&
                                  "text-right",
                              )}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((row, index) => (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-b border-border/40",
                              index % 2 === 1 && "bg-muted/25",
                            )}
                          >
                            <td className="px-3 py-2.5 font-medium">{row.name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {row.brandLabel || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {row.currentStock}
                            </td>
                            <td className="px-3 py-2.5 text-right text-base font-semibold tabular-nums text-foreground">
                              {row.orderQuantity}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {row.unitLabel}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {row.categoryName}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {row.productionSiteName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ModuleTableHorizontalScrollRegion>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppFullscreenOverlay>
  );
}
