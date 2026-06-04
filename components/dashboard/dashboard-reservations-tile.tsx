"use client";

import { CalendarDays } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactList,
  DashboardCompactListItem,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardReservationStats } from "@/lib/hooks/use-dashboard-reservation-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { reservationsUnconfirmedOverviewHref } from "@/lib/reservations/unconfirmed-reservations";

function formatReservationWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardReservationsTile() {
  const { summary, loading, error, ready } = useDashboardReservationStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const unconfirmed = summary?.unconfirmedCount ?? 0;

  return (
    <DashboardWidgetShell
      title="Reservierungen"
      icon={
        <CalendarDays
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/reservierungen/uebersicht"
      linkLabel="Zur Übersicht"
      ready={ready}
      loading={showSkeleton}
      error={error}
    >
      {summary ? (
        <div className="space-y-3">
          <DashboardCompactInlineMetrics>
            <DashboardCompactMetricPill
              label="Unbestätigt"
              value={String(unconfirmed)}
              href={unconfirmed > 0 ? reservationsUnconfirmedOverviewHref() : undefined}
              highlight={unconfirmed > 0}
              stripeVariant={unconfirmed > 0 ? "attention" : undefined}
            />
            <DashboardCompactMetricPill
              label="Heute"
              value={`${summary.todayReservations} · ${summary.todayGuests} Pers.`}
            />
            <DashboardCompactMetricPill
              label="Ø Pers. (KW)"
              value={
                summary.avgPartySizeWeek != null
                  ? String(summary.avgPartySizeWeek).replace(".", ",")
                  : "—"
              }
            />
          </DashboardCompactInlineMetrics>

          {summary.recent.length > 0 ? (
            <DashboardCompactList>
              {summary.recent.map((row) => (
                <DashboardCompactListItem
                  key={row.id}
                  href={row.href}
                  title={row.guestLabel}
                  meta={`${row.partySize} Pers. · ${row.statusName}`}
                  trailing={formatReservationWhen(row.startsAt)}
                  stripeVariant={row.unconfirmed ? "attention" : undefined}
                />
              ))}
            </DashboardCompactList>
          ) : (
            <p className="text-xs text-muted-foreground">
              Keine anstehenden Reservierungen.
            </p>
          )}
        </div>
      ) : null}
    </DashboardWidgetShell>
  );
}
