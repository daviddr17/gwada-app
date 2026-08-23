"use client";

import * as React from "react";
import { Activity, Trash2, X } from "lucide-react";
import { AppMobileChromeScreen } from "@/components/layout/app-mobile-chrome-screen";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
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
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

function formatRelativeActivityWhen(
  iso: string,
  timeZone: string,
  nowMs: number,
): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "";
  const deltaSec = Math.round((nowMs - at) / 1000);
  if (deltaSec < 45) return "Gerade eben";
  if (deltaSec < 3600) {
    const mins = Math.max(1, Math.round(deltaSec / 60));
    return `vor ${mins} Min.`;
  }
  if (isSameRestaurantCalendarDay(iso, new Date(nowMs), timeZone)) {
    if (deltaSec < 5 * 3600) {
      const hours = Math.max(1, Math.round(deltaSec / 3600));
      return `vor ${hours} Std.`;
    }
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

function ActivityRow({
  item,
  timeZone,
  nowMs,
  onNavigate,
}: {
  item: LiveActivityItem;
  timeZone: string;
  nowMs: number;
  onNavigate: () => void;
}) {
  const mod =
    item.module && isNotificationModuleId(item.module)
      ? NOTIFICATION_MODULES[item.module]
      : null;
  const Icon = mod?.icon ?? Activity;
  const href = item.href ?? mod?.href ?? null;
  const when = formatRelativeActivityWhen(item.at, timeZone, nowMs);

  const row = (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent ring-1 ring-accent/15">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {item.title}
          </p>
          <time
            className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
            dateTime={item.at}
          >
            {when}
          </time>
        </div>
        {item.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {item.description}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!href) return <li>{row}</li>;

  return (
    <li>
      <AppNavLink
        href={href}
        className="block transition-colors hover:bg-muted/50 active:bg-muted/70"
        onClick={onNavigate}
      >
        {row}
      </AppNavLink>
    </li>
  );
}

function LiveActivityPanel({
  items,
  timeZone,
  nowMs,
  layout,
  onNavigate,
  onClear,
}: {
  items: LiveActivityItem[];
  timeZone: string;
  nowMs: number;
  layout: "popover" | "screen";
  onNavigate: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        layout === "popover"
          ? "max-h-[min(32rem,72dvh)] w-[min(24rem,calc(100vw-1.25rem))]"
          : "h-full min-h-0",
      )}
    >
      {layout === "popover" ? (
        <div className="flex items-start justify-between gap-2 border-b border-border/40 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              Live-Verlauf
            </p>
            <p className="text-xs text-muted-foreground">
              Reservierungen, Nachrichten, Schicht & Bestand
            </p>
          </div>
          {items.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-full text-muted-foreground"
              aria-label="Verlauf leeren"
              title="Verlauf leeren"
              onClick={onClear}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <Activity className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium text-foreground">
              Noch ruhig hier
            </p>
            <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
              Neue Reservierungen, Nachrichten, Logins und Bestandswarnungen
              erscheinen hier live während der Schicht.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/35">
            {items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                timeZone={timeZone}
                nowMs={nowMs}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      {layout === "screen" && items.length > 0 ? (
        <div className="shrink-0 border-t border-border/40 p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl border-border/60"
            onClick={onClear}
          >
            <Trash2 className="size-3.5" />
            Verlauf leeren
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type AppChromeActivityFeedProps = {
  className?: string;
  popoverSide?: "top" | "bottom";
  /** Bottom-Nav: Label + Vollbild-Sheet. */
  variant?: "default" | "mobileNav";
  showLabel?: boolean;
  labelClassName?: string;
  onBeforeOpen?: () => void;
};

export function AppChromeActivityFeed({
  className,
  popoverSide = "bottom",
  variant = "default",
  showLabel = false,
  labelClassName,
  onBeforeOpen,
}: AppChromeActivityFeedProps = {}) {
  const [open, setOpen] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const useMobileScreen = variant === "mobileNav" || isMobile;
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const { items, hasUnseen, markSeen, clear } = useLiveActivityFeed();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (open) markSeen();
  }, [open, markSeen]);

  React.useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  const panel = (
    <LiveActivityPanel
      items={items}
      timeZone={timeZone}
      nowMs={nowMs}
      layout={useMobileScreen ? "screen" : "popover"}
      onNavigate={() => setOpen(false)}
      onClear={() => {
        clear();
      }}
    />
  );

  const openFeed = () => {
    onBeforeOpen?.();
    setOpen(true);
  };

  if (variant === "mobileNav") {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "relative h-full min-w-0 flex-1 flex-col gap-0.5 rounded-none px-0 text-muted-foreground hover:text-foreground",
            open && "text-foreground",
            className,
          )}
          aria-label={
            hasUnseen ? "Live-Verlauf — neue Ereignisse" : "Live-Verlauf"
          }
          aria-expanded={open}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            openFeed();
          }}
        >
          <span className="relative inline-flex">
            {open ? (
              <X className="size-5 shrink-0" />
            ) : (
              <Activity className="size-5 shrink-0" />
            )}
            {hasUnseen && !open ? (
              <span
                className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-background"
                aria-hidden
              />
            ) : null}
          </span>
          {showLabel ? (
            <span className={cn("leading-none", labelClassName)}>Live</span>
          ) : null}
        </Button>
        <AppMobileChromeScreen
          open={open}
          onClose={() => setOpen(false)}
          title="Live-Verlauf"
          aria-label="Live-Verlauf"
          headerAction={
            items.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Verlauf leeren"
                onClick={clear}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null
          }
        >
          {panel}
        </AppMobileChromeScreen>
      </>
    );
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn(
        "relative shrink-0 rounded-full border-border/60 transition-[border-color,background-color,transform] duration-200",
        open && "border-accent/50 bg-accent/10",
        hasUnseen && !open && "border-accent/35",
        className,
      )}
      aria-label={
        hasUnseen ? "Live-Verlauf — neue Ereignisse" : "Live-Verlauf"
      }
      aria-expanded={open}
      onClick={
        useMobileScreen
          ? () => {
              if (open) setOpen(false);
              else openFeed();
            }
          : undefined
      }
    >
      <span className="relative inline-flex">
        {open ? (
          <X className="size-4 transition-transform duration-200" />
        ) : (
          <Activity
            className={cn(
              "size-4 transition-transform duration-200",
              hasUnseen && "scale-105",
            )}
          />
        )}
        {hasUnseen && !open ? (
          <span
            className="pointer-events-none absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-background"
            aria-hidden
          />
        ) : null}
      </span>
    </Button>
  );

  if (useMobileScreen) {
    return (
      <>
        {trigger}
        <AppMobileChromeScreen
          open={open}
          onClose={() => setOpen(false)}
          title="Live-Verlauf"
          aria-label="Live-Verlauf"
          headerAction={
            items.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Verlauf leeren"
                onClick={clear}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null
          }
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
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn(
              "relative shrink-0 rounded-full border-border/60 transition-[border-color,background-color] duration-200",
              open && "border-accent/50 bg-accent/10",
              hasUnseen && !open && "border-accent/35",
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
          <PopoverContent className="overflow-hidden border-border/50 bg-popover/95 p-0 shadow-lg backdrop-blur-xl dark:shadow-2xl">
            {panel}
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
