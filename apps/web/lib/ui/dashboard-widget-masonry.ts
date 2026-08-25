import { cn } from "@/lib/utils";

/**
 * Dashboard-Home: Mobil eine Spalte, ab lg zweispaltiges Grid mit items-start
 * (Kacheln in natürlicher Höhe, Oberkanten pro Zeile bündig — kein CSS-Columns,
 * das die rechte Spalte unter Heute/column-span versetzt).
 */
export const dashboardWidgetStackClassName = "flex flex-col gap-4 pt-2";

export const dashboardWidgetMasonryClassName =
  "grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start";

export function dashboardWidgetMasonryItemClassName(_span: 1 | 2): string {
  return cn("min-w-0");
}
