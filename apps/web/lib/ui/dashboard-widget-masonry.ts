import { cn } from "@/lib/utils";

/**
 * Dashboard-Home: Mobil eine Flex-Spalte (kein CSS-Columns — iOS Safari
 * lässt Column-Items sonst über das AppMain-Padding in den Bildschirmrand laufen).
 * Ab lg Pinnwand mit CSS-Columns.
 */
export const dashboardWidgetMasonryClassName =
  "flex flex-col gap-4 pt-2 lg:block lg:columns-2 lg:gap-4";

export function dashboardWidgetMasonryItemClassName(span: 1 | 2): string {
  return cn(
    "min-w-0 lg:mb-4 lg:break-inside-avoid",
    span === 2 && "lg:[column-span:all]",
  );
}
