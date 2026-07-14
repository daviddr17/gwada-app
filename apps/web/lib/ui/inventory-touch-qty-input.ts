import { cn } from "@/lib/utils";

/** Große Mengen-Eingabe auf Mobile-Bestand-/Bestellung-Karten. */
export const inventoryTouchQtyInputClassName =
  "h-14 w-full rounded-2xl border border-input bg-background px-4 text-center text-2xl font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50";

export const inventoryTouchQtyUnitSuffixClassName =
  "pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-muted-foreground";

export function inventoryTouchOrderQtyHighlightCn(active: boolean): string {
  return cn(
    inventoryTouchQtyInputClassName,
    "pr-16",
    active &&
      "border-emerald-600 ring-2 ring-emerald-600/25 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/35 dark:border-emerald-500 dark:ring-emerald-500/25 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/35",
  );
}
