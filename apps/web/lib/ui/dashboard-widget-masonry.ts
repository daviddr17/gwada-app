import { cn } from "@/lib/utils";

/**
 * Dashboard-Home: Mobil eine Flex-Spalte (kein CSS-Columns — iOS Safari
 * lässt Column-Items sonst über das AppMain-Padding in den Bildschirmrand laufen).
 * Ab lg Pinnwand mit CSS-Columns — ohne `column-span` (sonst startet die
 * rechte Spalte unter dem Heute-Widget tiefer als die linke).
 */
export const dashboardWidgetStackClassName = "flex flex-col gap-4 pt-2";

export const dashboardWidgetMasonryClassName =
  "flex min-w-0 flex-col gap-4 lg:block lg:columns-2 lg:gap-x-4";

export function dashboardWidgetMasonryItemClassName(span: 1 | 2): string {
  return cn(
    "min-w-0",
    span === 1 && "lg:mb-4 lg:break-inside-avoid",
  );
}
