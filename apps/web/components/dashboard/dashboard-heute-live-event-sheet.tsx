"use client";

import { Activity } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import {
  formatRestaurantDateTime,
  isSameRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

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

/** Detail-Sheet für Live-Einträge ohne eigenes Modul-Sheet. */
export function DashboardHeuteLiveEventSheet({
  open,
  onOpenChange,
  item,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: LiveActivityItem | null;
  timeZone: string;
}) {
  if (!item) return null;

  const mod =
    item.module && isNotificationModuleId(item.module)
      ? NOTIFICATION_MODULES[item.module]
      : null;
  const Icon = mod?.icon ?? Activity;
  const href = item.href ?? mod?.href ?? null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {item.title}
          </DrawerTitle>
          <DrawerDescription>{formatWhen(item.at, timeZone)}</DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              {mod ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {mod.label}
                </p>
              ) : null}
              {item.description ? (
                <p className="mt-1 text-sm leading-snug text-foreground">
                  {item.description}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Keine weiteren Details.
                </p>
              )}
            </div>
          </div>
        </div>
        {href ? (
          <div className="border-t border-border/50 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <Button
              render={
                <AppNavLink href={href} onClick={() => onOpenChange(false)} />
              }
              className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
            >
              Zum Modul öffnen
            </Button>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
