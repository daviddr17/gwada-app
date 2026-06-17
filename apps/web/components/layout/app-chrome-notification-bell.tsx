"use client";

import * as React from "react";
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
import { cn } from "@/lib/utils";

export function AppChromeNotificationBell() {
  const [open, setOpen] = React.useState(false);
  const { summary, totalCount, isLoading, ready, markRead, markModuleRead, refresh } =
    useNotificationSummary();
  const showSkeleton = useDeferredSkeleton(isLoading && !summary);

  React.useEffect(() => {
    if (open && ready) {
      void refresh({ silent: true });
    }
  }, [open, ready, refresh]);

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
                loading={isLoading}
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
