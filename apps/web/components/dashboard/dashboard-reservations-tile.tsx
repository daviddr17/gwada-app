"use client";

import { useState } from "react";
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
import type { DashboardReservationRecent } from "@/lib/reservations/compute-dashboard-reservation-summary";

type DashboardReservationsView = "unconfirmed" | "today";

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

function formatReservationTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardReservationsTile() {
  const { summary, loading, error, ready } = useDashboardReservationStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const [view, setView] = useState<DashboardReservationsView>("unconfirmed");
  const unconfirmed = summary?.unconfirmedCount ?? 0;

  const listRows: DashboardReservationRecent[] =
    view === "today"
      ? (summary?.todayList ?? [])
      : (summary?.unconfirmedList ?? []);

  const emptyMessage =
    view === "today"
      ? "Keine Reservierungen für heute."
      : "Keine unbestätigten Reservierungen.";

  return (
    <DashboardWidgetShell
      title="Reservierungen"
      icon={
        <CalendarDays
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      }
      href="/dashboard/reservierungen/uebersicht"
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
              onClick={() => setView("unconfirmed")}
              highlight={view === "unconfirmed"}
              stripeVariant={
                view === "unconfirmed" && unconfirmed > 0 ? "attention" : undefined
              }
            />
            <DashboardCompactMetricPill
              label="Heute"
              value={`${summary.todayReservations} · ${summary.todayGuests} Pers.`}
              onClick={() => setView("today")}
              highlight={view === "today"}
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

          {listRows.length > 0 ? (
            <DashboardCompactList
              aria-label={
                view === "today"
                  ? "Heutige Reservierungen"
                  : "Unbestätigte Reservierungen"
              }
            >
              {listRows.map((row) => (
                <DashboardCompactListItem
                  key={row.id}
                  href={row.href}
                  title={row.guestLabel}
                  meta={`${row.partySize} Pers. · ${row.statusName}`}
                  trailing={
                    view === "today"
                      ? formatReservationTime(row.startsAt)
                      : formatReservationWhen(row.startsAt)
                  }
                  stripeVariant={row.unconfirmed ? "attention" : undefined}
                />
              ))}
            </DashboardCompactList>
          ) : (
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      ) : null}
    </DashboardWidgetShell>
  );
}
