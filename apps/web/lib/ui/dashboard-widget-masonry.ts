import { cn } from "@/lib/utils";

/** Dashboard-Home: CSS-Columns-Pinnwand — Kacheln in natürlicher Höhe. */
export const dashboardWidgetMasonryClassName =
  "columns-1 gap-4 pt-2 lg:columns-2";

export function dashboardWidgetMasonryItemClassName(span: 1 | 2): string {
  return cn(
    "mb-4 min-w-0 break-inside-avoid",
    span === 2 && "[column-span:all]",
  );
}
