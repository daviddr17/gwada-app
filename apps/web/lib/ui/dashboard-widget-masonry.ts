import { cn } from "@/lib/utils";

/**
 * Dashboard-Home: Mobil eine Spalte, ab lg zwei unabhängige Flex-Spalten
 * (Oberkanten bündig, Kacheln pro Spalte ohne Grid-Zeilenhöhe dicht gestapelt).
 */
export const dashboardWidgetStackClassName = "flex flex-col gap-4 pt-2";

export const dashboardWidgetMasonryClassName =
  "hidden min-w-0 grid-cols-2 items-start gap-4 lg:grid";

export const dashboardWidgetMasonryMobileStackClassName =
  "flex min-w-0 flex-col gap-4 lg:hidden";

export const dashboardWidgetMasonryLaneClassName =
  "flex min-w-0 flex-col gap-4";

export function dashboardWidgetMasonryItemClassName(_span: 1 | 2): string {
  return cn("min-w-0");
}
