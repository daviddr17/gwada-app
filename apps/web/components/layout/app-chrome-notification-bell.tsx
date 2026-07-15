"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { AppMobileChromeScreen } from "@/components/layout/app-mobile-chrome-screen";
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
import {
  isRestaurantDashboardPath,
  useDashboardGlobalSearchOptional,
} from "@/lib/contexts/dashboard-global-search-context";
import { NOTIFICATION_SUMMARY_STALE_MS } from "@/lib/query/dashboard-query-policy";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

type AppChromeNotificationBellProps = {
  className?: string;
  /** Popover-Richtung — Desktop-Default `bottom`. */
  popoverSide?: "top" | "bottom";
  /** Label unter dem Icon (Bottom-Nav). */
  showLabel?: boolean;
  labelClassName?: string;
  /** Bottom-Nav: Vollbild-Overlay statt Popover. */
  variant?: "default" | "mobileNav";
  /** Vor dem Öffnen andere Overlays schließen. */
  onBeforeOpen?: () => void;
};

export function AppChromeNotificationBell({
  className,
  popoverSide = "bottom",
  showLabel = false,
  labelClassName,
  variant = "default",
  onBeforeOpen,
}: AppChromeNotificationBellProps = {}) {
  const [open, setOpen] = React.useState(false);
  const useMobileScreen = variant === "mobileNav";
  const pathname = usePathname();
  const { openMobile } = useSidebar();
  const search = useDashboardGlobalSearchOptional();
  const searchOpen =
    Boolean(search?.open) && isRestaurantDashboardPath(pathname);
  const queryClient = useQueryClient();
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { summary, totalCount, isLoading, isFetching, ready, markRead, markModuleRead, refresh } =
    useNotificationSummary();
  const showSkeleton = useDeferredSkeleton(
    (isLoading || isFetching) && !summary,
  );

  React.useEffect(() => {
    if (!useMobileScreen) return;
    if (openMobile || searchOpen) setOpen(false);
  }, [useMobileScreen, openMobile, searchOpen]);

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

  const panel =
    showSkeleton && !summary ? (
      <NotificationBellPanelSkeleton layout={useMobileScreen ? "screen" : "popover"} />
    ) : (
      <NotificationBellPanel
        summary={summary}
        loading={isFetching && !summary}
        timeZone={restaurantTimeZone}
        layout={useMobileScreen ? "screen" : "popover"}
        onMarkRead={markRead}
        onMarkModuleRead={markModuleRead}
        onNavigate={() => setOpen(false)}
      />
    );

  const triggerButton = (
    <Button
      type="button"
      variant={showLabel ? "ghost" : "outline"}
      size={showLabel ? "default" : "icon-sm"}
      className={cn(
        showLabel
          ? "relative h-full min-w-0 flex-1 flex-col gap-0.5 rounded-none px-0 text-muted-foreground hover:text-foreground"
          : "relative shrink-0 rounded-full border-border/60",
        open && showLabel && "text-foreground",
        className,
      )}
      aria-label={
        badge ? `${totalCount} Benachrichtigungen` : "Benachrichtigungen"
      }
      aria-expanded={open}
      onClick={() => {
        if (open) {
          setOpen(false);
          return;
        }
        onBeforeOpen?.();
        setOpen(true);
      }}
    >
      <span className="relative inline-flex">
        {open && showLabel ? (
          <X className={cn("shrink-0", showLabel ? "size-5" : "size-4")} />
        ) : (
          <Bell className={cn("shrink-0", showLabel ? "size-5" : "size-4")} />
        )}
        {badge && !(open && showLabel) ? (
          <span
            className={cn(
              "pointer-events-none absolute -top-1 -right-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 py-0.5 text-[10px] font-bold leading-none text-accent-foreground shadow-sm",
            )}
            aria-hidden
          >
            {badge}
          </span>
        ) : null}
      </span>
      {showLabel ? (
        <span className={cn("leading-none", labelClassName)}>Meldungen</span>
      ) : null}
    </Button>
  );

  if (useMobileScreen) {
    return (
      <>
        {triggerButton}
        <AppMobileChromeScreen
          open={open}
          onClose={() => setOpen(false)}
          title="Benachrichtigungen"
          aria-label="Benachrichtigungen"
        >
          {panel}
        </AppMobileChromeScreen>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(
              "relative shrink-0 rounded-full border-border/60",
              className,
            )}
            aria-label={
              badge
                ? `${totalCount} Benachrichtigungen`
                : "Benachrichtigungen"
            }
          />
        }
      >
        <span className="relative inline-flex">
          <Bell className="size-4 shrink-0" />
          {badge ? (
            <span
              className="pointer-events-none absolute -top-1 -right-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-accent px-1 py-0.5 text-[10px] font-bold leading-none text-accent-foreground shadow-sm"
              aria-hidden
            >
              {badge}
            </span>
          ) : null}
        </span>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner
          align="center"
          side={popoverSide}
          sideOffset={8}
        >
          <PopoverContent className="p-0">
            {panel}
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
