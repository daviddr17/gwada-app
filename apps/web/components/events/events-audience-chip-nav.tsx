"use client";

import {
  EVENTS_FILTER_PRIVATE,
  EVENTS_FILTER_PRIVATE_LABEL,
  EVENTS_FILTER_PUBLIC,
  EVENTS_FILTER_PUBLIC_LABEL,
  type EventsDashboardFilter,
} from "@/lib/events/events-dashboard-filter";
import { cn } from "@/lib/utils";

export function EventsAudienceChipNav({
  value,
  onChange,
  className,
}: {
  value: EventsDashboardFilter;
  onChange: (next: EventsDashboardFilter) => void;
  className?: string;
}) {
  const options: { id: EventsDashboardFilter; label: string }[] = [
    { id: EVENTS_FILTER_PUBLIC, label: EVENTS_FILTER_PUBLIC_LABEL },
    { id: EVENTS_FILTER_PRIVATE, label: EVENTS_FILTER_PRIVATE_LABEL },
  ];

  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="navigation"
      aria-label="Events-Ansicht"
    >
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-accent/50 bg-accent/15 text-foreground"
                : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
            )}
            onClick={() => {
              if (active) return;
              onChange(id);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
