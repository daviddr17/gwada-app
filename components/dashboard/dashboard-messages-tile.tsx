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

function formatMessageWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

export function DashboardMessagesTile() {
  const { summary, error, loading } = useDashboardMessagesStats();
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
      ready
      loading={loading}
      error={error}
    >
      {summary ? (
        <div className="space-y-3">
          <DashboardCompactInlineMetrics>
            <DashboardCompactMetricPill
              label="Ungelesen"
              value={String(total)}
              href={total > 0 ? "/dashboard/kontakte/nachrichten?platform=all" : undefined}
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
                        ? `${row.unreadCount} · ${formatMessageWhen(row.lastAt)}`
                        : formatMessageWhen(row.lastAt)}
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
