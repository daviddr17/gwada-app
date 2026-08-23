"use client";

import type { ReactNode } from "react";
import { CalendarDays, Clock, DoorClosed } from "lucide-react";
import type { DashboardCalendarDaySummary } from "@/lib/dashboard/dashboard-calendar-types";
import { cn } from "@/lib/utils";

/** Status-Icons (Geschlossen / Sonderzeiten / Feiertag) — ohne Signal-Farben. */
export function DashboardCalendarDayStatusIcons({
  day,
  className,
  size = "sm",
}: {
  day: DashboardCalendarDaySummary;
  className?: string;
  size?: "sm" | "md";
}) {
  const iconClass = size === "md" ? "size-3.5" : "size-3";
  const items: Array<{ key: string; node: ReactNode; title: string }> = [];

  if (day.holidayName) {
    items.push({
      key: "holiday",
      title: day.holidayName,
      node: (
        <CalendarDays
          className={cn(iconClass, "text-muted-foreground")}
          aria-hidden
        />
      ),
    });
  }
  if (day.hoursException?.closed) {
    items.push({
      key: "closed",
      title: day.hoursException.label,
      node: (
        <DoorClosed
          className={cn(iconClass, "text-muted-foreground")}
          aria-hidden
        />
      ),
    });
  } else if (day.hoursException) {
    items.push({
      key: "hours",
      title: day.hoursException.label,
      node: (
        <Clock className={cn(iconClass, "text-muted-foreground")} aria-hidden />
      ),
    });
  }

  if (items.length === 0) {
    return <span className={cn("h-3 md:h-3.5", className)} aria-hidden />;
  }

  return (
    <span
      className={cn(
        "flex h-3 items-center justify-center gap-0.5 md:h-3.5 md:gap-1",
        className,
      )}
    >
      {items.map(({ key, node, title }) => (
        <span key={key} title={title} className="inline-flex shrink-0">
          {node}
        </span>
      ))}
    </span>
  );
}

export function DashboardCalendarStatusLegend() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
        <DoorClosed className="size-3 text-muted-foreground" aria-hidden />
        Geschlossen
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
        <Clock className="size-3 text-muted-foreground" aria-hidden />
        Sonderzeiten
      </span>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
        <CalendarDays className="size-3 text-muted-foreground" aria-hidden />
        Feiertag
      </span>
    </>
  );
}
