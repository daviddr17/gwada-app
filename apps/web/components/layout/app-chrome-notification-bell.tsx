"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { NotificationBellPanel } from "@/components/notifications/notification-bell-panel";
import { NotificationBellPanelSkeleton } from "@/components/notifications/notification-bell-panel-skeleton";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNotificationSummary } from "@/lib/hooks/use-notification-summary";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { NOTIFICATION_SUMMARY_STALE_MS } from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

export function AppChromeNotificationBell() {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { summary, totalCount, isLoading, isFetching, ready, markRead, markModuleRead, refresh } =
    useNotificationSummary();
  const showSkeleton = useDeferredSkeleton(
    (isLoading || isFetching) && !summary,
  );

  React.useEffect(() => {
    if (!open || !ready || !restaurantId) return;
    const state = queryClient.getQueryState(
      queryKeys.notifications.summary(restaurantId),
    );
    const updatedAt = state?.dataUpdatedAt ?? 0;
    if (summary && Date.now() - updatedAt < NOTIFICATION_SUMMARY_STALE_MS) {
      return;
    }
    void refresh({ silent: true });
  }, [open, ready, refresh, restaurantId, queryClient, summary]);

  if (!ready) return null;

  const badge =
    totalCount > 0 ? (totalCount > 99 ? "99+" : String(totalCount)) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="relative shrink-0 rounded-full border-border/60"
            aria-label={
              badge
                ? `${totalCount} Benachrichtigungen`
                : "Benachrichtigungen"
            }
          />
        }
      >
        <Bell className="size-4" />
        {badge ? (
          <span
            className={cn(
              "pointer-events-none absolute -top-1 -right-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 py-0.5 text-[10px] font-bold leading-none text-accent-foreground shadow-sm",
            )}
            aria-hidden
          >
            {badge}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner align="end" side="bottom" sideOffset={8}>
          <PopoverContent className="p-0">
            {showSkeleton && !summary ? (
              <NotificationBellPanelSkeleton />
            ) : (
              <NotificationBellPanel
                summary={summary}
                loading={isFetching && !summary}
                timeZone={restaurantTimeZone}
                onMarkRead={markRead}
                onMarkModuleRead={markModuleRead}
                onNavigate={() => setOpen(false)}
              />
            )}
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
