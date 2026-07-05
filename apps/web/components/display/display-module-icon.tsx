"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChefHat,
  ClipboardCheck,
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
  compliance: ClipboardCheck,
  kds: MonitorPlay,
};

export function DisplayModuleIcon({
  module,
  className,
}: {
  module: DisplayModule | null | undefined;
  className?: string;
}) {
  const Icon = module ? MODULE_ICONS[module] : Clock;
  return <Icon className={cn("shrink-0", className)} aria-hidden />;
}
