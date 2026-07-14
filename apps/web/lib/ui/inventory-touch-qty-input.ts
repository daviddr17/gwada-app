import { cn } from "@/lib/utils";

/** Kompakte Touch-Mengen auf Mobile-Karten (Bestand / Bestellung nebeneinander). */
export const inventoryTouchQtyInputClassName =
  "h-12 w-full min-w-0 rounded-2xl border px-2 text-center text-xl font-semibold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:px-3 sm:text-2xl";

export const inventoryTouchQtyUnitSuffixClassName =
  "pointer-events-none absolute top-1/2 right-2 max-w-[42%] -translate-y-1/2 truncate text-[10px] font-medium text-muted-foreground sm:right-3 sm:text-xs";

/** Bestand: kühles Sky, ruhig. */
export const inventoryTouchStockQtyInputClassName = cn(
  inventoryTouchQtyInputClassName,
  "border-sky-500/30 bg-sky-500/10 pr-11 text-sky-950 focus-visible:border-sky-500/55 dark:bg-sky-500/12 dark:text-sky-50",
);

/** Bestellung: Grün, Aktion — stärker wenn Menge > 0. */
export function inventoryTouchOrderQtyInputCn(active: boolean): string {
  return cn(
    inventoryTouchQtyInputClassName,
    "pr-11",
    active
      ? "border-emerald-600 bg-emerald-500/18 text-emerald-950 ring-2 ring-emerald-600/20 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/35 dark:border-emerald-500 dark:bg-emerald-500/22 dark:text-emerald-50"
      : "border-emerald-500/35 bg-emerald-500/10 text-foreground focus-visible:border-emerald-500/55 dark:bg-emerald-500/12",
  );
}
