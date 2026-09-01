"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ingredientInactiveRowClassName = "opacity-60";

export function IngredientInactiveBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 shrink-0 px-1.5 text-[0.65rem] font-medium", className)}
    >
      Inaktiv
    </Badge>
  );
}
