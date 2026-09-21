"use client";

import { Activity } from "lucide-react";
import { useLiveActivityFeed } from "@/lib/hooks/use-live-activity-feed";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import {
  formatRestaurantDateTime,
  isSameRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

const MAX_ROWS = 5;

function formatWhen(iso: string, timeZone: string): string {
  if (isSameRestaurantCalendarDay(iso, new Date(), timeZone)) {
    return formatRestaurantDateTime(iso, timeZone, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return formatRestaurantDateTime(iso, timeZone, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Kompakte Tages-Timeline im Heute-Widget — speist aus Live-Verlauf. */
export function DashboardHeuteLiveTimeline({
  className,
  onSelectItem,
}: {
  className?: string;
  /** Im Heute-Widget: Bottom Sheet statt Modul-Navigation. */
  onSelectItem?: (item: LiveActivityItem) => void;
}) {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const { items } = useLiveActivityFeed();
  const todayItems = items.filter((item) =>
    isSameRestaurantCalendarDay(item.at, new Date(), timeZone),
  );
  const rows = todayItems.slice(0, MAX_ROWS);

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/40 bg-background/50 px-3 py-3",
          className,
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Heute live
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Keine Einträge heute
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-background/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/35 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Heute live
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {rows.length}
          {todayItems.length > MAX_ROWS ? `+` : ""} Einträge
        </span>
      </div>
      <ul className="divide-y divide-border/30">
        {rows.map((item) => {
          const mod =
            item.module && isNotificationModuleId(item.module)
              ? NOTIFICATION_MODULES[item.module]
              : null;
          const Icon = mod?.icon ?? Activity;
          const body = (
            <div className="flex items-start gap-2.5 px-3 py-2">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-medium text-foreground">
                    {item.title}
                  </p>
                  <time
                    className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                    dateTime={item.at}
                  >
                    {formatWhen(item.at, timeZone)}
                  </time>
                </div>
                {item.description ? (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
          return (
            <li key={item.id}>
              {onSelectItem ? (
                <button
                  type="button"
                  className="block w-full text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => onSelectItem(item)}
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
