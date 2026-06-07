"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChefHat,
  Clock,
  MonitorPlay,
  Package,
} from "lucide-react";
import type { DisplayModule } from "@/lib/display/display-types";
import { cn } from "@/lib/utils";

const MODULE_ICONS: Record<DisplayModule, LucideIcon> = {
  time: Clock,
  reservations: CalendarDays,
  recipes: ChefHat,
  inventory: Package,
  kds: MonitorPlay,
};

export function DisplayModuleIcon({
  module,
  className,
}: {
  module: DisplayModule;
  className?: string;
}) {
  const Icon = MODULE_ICONS[module];
  return <Icon className={cn("shrink-0", className)} aria-hidden />;
}
