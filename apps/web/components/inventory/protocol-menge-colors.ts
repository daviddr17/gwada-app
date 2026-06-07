import { cn } from "@/lib/utils";

/** Farbe für die dargestellte Mengenänderung (positiv grün, negativ rot). */
export function protocolDeltaTextClass(delta: number): string {
  if (delta > 0) return "text-emerald-600 dark:text-emerald-400";
  if (delta < 0) return "text-red-600 dark:text-red-400";
  return "text-foreground";
}

export function protocolDeltaWrapClass(delta: number, tabular = true): string {
  return cn("font-medium", protocolDeltaTextClass(delta), tabular && "tabular-nums");
}
