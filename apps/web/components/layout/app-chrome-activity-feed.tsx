"use client";

import * as React from "react";
import { Activity, X } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLiveActivityFeed } from "@/lib/hooks/use-live-activity-feed";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import {
  formatRestaurantDateTime,
  isSameRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

function formatActivityWhen(iso: string, timeZone: string): string {
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

type AppChromeActivityFeedProps = {
  className?: string;
  popoverSide?: "top" | "bottom";
};

export function AppChromeActivityFeed({
  className,
  popoverSide = "bottom",
}: AppChromeActivityFeedProps = {}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const { items, hasUnseen, markSeen } = useLiveActivityFeed();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (open) markSeen();
  }, [open, markSeen]);

  const panel = (
    <div className="flex max-h-[min(28rem,70dvh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col">
      <div className="border-b border-border/50 px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">Live-Verlauf</p>
        <p className="text-xs text-muted-foreground">
          Was heute im Restaurant passiert ist
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Noch keine Live-Ereignisse in dieser Sitzung.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map((item) => {
              const mod =
                item.module && isNotificationModuleId(item.module)
                  ? NOTIFICATION_MODULES[item.module]
                  : null;
              const Icon = mod?.icon ?? Activity;
              const href = item.href ?? mod?.href ?? null;
              const row = (
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <time
                        className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                        dateTime={item.at}
                      >
                        {formatActivityWhen(item.at, timeZone)}
                      </time>
                    </div>
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
              return (
                <li key={item.id}>
                  {href ? (
                    <AppNavLink
                      href={href}
                      className="block transition-colors hover:bg-muted/40"
                      onClick={() => setOpen(false)}
                    >
                      {row}
                    </AppNavLink>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn(
              "relative shrink-0 rounded-full border-border/60",
              open && "border-accent/50 bg-accent/10",
              className,
            )}
            aria-label={
              hasUnseen ? "Live-Verlauf — neue Ereignisse" : "Live-Verlauf"
            }
          />
        }
      >
        <span className="relative inline-flex">
          {open ? <X className="size-4" /> : <Activity className="size-4" />}
          {hasUnseen && !open ? (
            <span
              className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </span>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner side={popoverSide} align="end" sideOffset={8}>
          <PopoverContent className="overflow-hidden p-0">
            {panel}
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
