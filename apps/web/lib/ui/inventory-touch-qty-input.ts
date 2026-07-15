import { cn } from "@/lib/utils";

/** Kompakte Touch-Mengen auf Mobile-Karten (Bestand / Bestellung nebeneinander). */
export const inventoryTouchQtyInputClassName =
  "h-12 w-full min-w-0 rounded-2xl border px-2 text-center text-xl font-semibold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:px-3 sm:text-2xl";

/** Kompaktansicht: mehr Zeilen auf dem Bildschirm, weiterhin touch-tauglich. */
export const inventoryCompactQtyInputClassName =
  "h-9 w-full min-w-[4.75rem] max-w-[7rem] rounded-xl border px-1.5 text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50";

export const inventoryTouchQtyUnitSuffixClassName =
  "pointer-events-none absolute top-1/2 right-2 max-w-[42%] -translate-y-1/2 truncate text-[10px] font-medium text-muted-foreground sm:right-3 sm:text-xs";

export const inventoryCompactQtyUnitSuffixClassName =
  "pointer-events-none absolute top-1/2 right-1 max-w-[48%] -translate-y-1/2 truncate text-[9px] font-medium text-muted-foreground";

export type InventoryQtyInputDensity = "touch" | "compact";

function inventoryQtyInputShellClassName(density: InventoryQtyInputDensity): string {
  return density === "compact"
    ? inventoryCompactQtyInputClassName
    : inventoryTouchQtyInputClassName;
}

function inventoryQtyUnitSuffixClassName(density: InventoryQtyInputDensity): string {
  return density === "compact"
    ? inventoryCompactQtyUnitSuffixClassName
    : inventoryTouchQtyUnitSuffixClassName;
}

/** Bestand: kühles Sky, ruhig. */
export function inventoryTouchStockQtyInputCn(
  density: InventoryQtyInputDensity = "touch",
): string {
  return cn(
    inventoryQtyInputShellClassName(density),
    density === "compact" ? "pr-9" : "pr-11",
    "border-sky-500/30 bg-sky-500/10 text-sky-950 focus-visible:border-sky-500/55 dark:bg-sky-500/12 dark:text-sky-50",
  );
}

/** @deprecated Nutze inventoryTouchStockQtyInputCn — bleibt für bestehende Imports. */
export const inventoryTouchStockQtyInputClassName = inventoryTouchStockQtyInputCn("touch");

/** Bestellung: Grün, Aktion — stärker wenn Menge > 0. */
export function inventoryTouchOrderQtyInputCn(
  active: boolean,
  density: InventoryQtyInputDensity = "touch",
): string {
  return cn(
    inventoryQtyInputShellClassName(density),
    density === "compact" ? "pr-9" : "pr-11",
    active
      ? "border-emerald-600 bg-emerald-500/18 text-emerald-950 focus-visible:border-emerald-600 dark:border-emerald-500 dark:bg-emerald-500/22 dark:text-emerald-50"
      : "border-emerald-500/35 bg-emerald-500/10 text-foreground focus-visible:border-emerald-500/55 dark:bg-emerald-500/12",
  );
}
