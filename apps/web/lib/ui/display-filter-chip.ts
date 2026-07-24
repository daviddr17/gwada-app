import { cn } from "@/lib/utils";

/** Display-Filter-/View-Chips — Soft-Tint wie Brand-Actions, kein Voll-Akzent. */
export function displayFilterChipClassName(active: boolean) {
  return cn(
    "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    active
      ? "border-accent/50 bg-accent/15 text-foreground"
      : "border-border/60 bg-muted/30 text-muted-foreground",
  );
}
