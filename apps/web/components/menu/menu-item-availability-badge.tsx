"use client";

import { CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatMenuItemAvailabilityRangeDe,
  menuItemAvailabilityPhase,
  menuItemHasAvailabilityWindow,
} from "@/lib/menu/item-utils";
import type { MenuItem } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

type MenuItemAvailabilityBadgeProps = {
  item: MenuItem;
  className?: string;
};

export function MenuItemAvailabilityBadge({
  item,
  className,
}: MenuItemAvailabilityBadgeProps) {
  if (!menuItemHasAvailabilityWindow(item)) return null;

  const phase = menuItemAvailabilityPhase(item);
  const label = formatMenuItemAvailabilityRangeDe(
    item.availableFrom,
    item.availableTo,
  );
  if (!label) return null;

  return (
    <Badge
      variant="outline"
      title={
        phase === "upcoming"
          ? "Noch nicht im Anzeigezeitraum"
          : phase === "expired"
            ? "Anzeigezeitraum abgelaufen"
            : "Anzeigezeitraum"
      }
      className={cn(
        "h-6 shrink-0 gap-1 rounded-full px-2 text-[0.65rem] font-medium",
        phase === "active" &&
          "border-accent/35 bg-accent/10 text-accent",
        phase === "upcoming" &&
          "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        phase === "expired" &&
          "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <CalendarRange className="size-3 shrink-0" aria-hidden />
      {label}
    </Badge>
  );
}
