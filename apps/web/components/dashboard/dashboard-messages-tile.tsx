"use client";

import { MessageCircle } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactList,
  DashboardCompactListItem,
  DashboardCompactMetricPill,
  DashboardMessagesTileSkeleton,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardMessagesStats } from "@/lib/hooks/use-dashboard-messages-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { dashboardMessagesInboxHref } from "@/lib/contact-messages/messages-unread-summary";
import {
  formatRestaurantDateTime,
  isSameRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";

function formatMessageWhen(iso: string, timeZone: string): string {
  if (isSameRestaurantCalendarDay(iso, new Date(), timeZone)) {
    return formatRestaurantDateTime(iso, timeZone, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return formatRestaurantDateTime(iso, timeZone, {
    day: "2-digit",
    month: "short",
  });
}

export function DashboardMessagesTile() {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { summary, error, loading, ready } = useDashboardMessagesStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const total = summary?.total_unread ?? 0;

  return (
    <DashboardWidgetShell
      title="Nachrichten"
      staticChrome
      loadingContent={<DashboardMessagesTileSkeleton />}
      icon={
        <MessageCircle
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/kontakte/nachrichten?platform=all"
      linkLabel="Zu Nachrichten"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      {summary ? (
        <div className="space-y-3">
          <DashboardCompactInlineMetrics>
            <DashboardCompactMetricPill
              label="Ungelesen"
              value={String(total)}
              href={total > 0 ? dashboardMessagesInboxHref({ read: "unread" }) : undefined}
              highlight={total > 0}
              stripeVariant="attention"
            />
          </DashboardCompactInlineMetrics>

          {summary.unread.length > 0 ? (
            <DashboardCompactList>
              {summary.unread.map((row) => (
                <DashboardCompactListItem
                  key={row.contactId}
                  href={row.href}
                  title={row.contactName}
                  meta={row.preview}
                  stripeVariant="attention"
                  trailing={
                    <span className="tabular-nums">
                      {row.unreadCount > 1
                        ? `${row.unreadCount} · ${formatMessageWhen(row.lastAt, restaurantTimeZone)}`
                        : formatMessageWhen(row.lastAt, restaurantTimeZone)}
                    </span>
                  }
                />
              ))}
            </DashboardCompactList>
          ) : (
            <p className="text-xs text-muted-foreground">
              Keine ungelesenen Nachrichten.
            </p>
          )}
        </div>
      ) : null}
    </DashboardWidgetShell>
  );
}
