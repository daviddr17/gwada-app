"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardReservationsListSheet } from "@/components/dashboard/dashboard-reservations-list-sheet";
import type { DashboardReservationsListSheetMode } from "@/components/dashboard/dashboard-reservations-list-sheet";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { useDashboardReservationStats } from "@/lib/hooks/use-dashboard-reservation-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function DashboardReservationsTile() {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { summary, loading, error, ready } = useDashboardReservationStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const [sheetMode, setSheetMode] =
    useState<DashboardReservationsListSheetMode | null>(null);

  const unconfirmed = summary?.unconfirmedCount ?? 0;
  const todayUpcomingReservations = summary?.todayUpcomingReservations ?? 0;
  const todayUpcomingGuests = summary?.todayUpcomingGuests ?? 0;

  const sheetRows =
    sheetMode === "today_upcoming"
      ? (summary?.todayUpcomingList ?? [])
      : sheetMode === "unconfirmed"
        ? (summary?.unconfirmedList ?? [])
        : [];

  const sheetDescription =
    sheetMode === "today_upcoming"
      ? `${todayUpcomingReservations} Reservierungen · ${todayUpcomingGuests} Personen`
      : sheetMode === "unconfirmed"
        ? `${unconfirmed} offen`
        : undefined;

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
        <DashboardCompactInlineMetrics>
          <DashboardCompactMetricPill
            label="Unbestätigt"
            value={String(unconfirmed)}
            onClick={() => setSheetMode("unconfirmed")}
            highlight={unconfirmed > 0}
            stripeVariant={unconfirmed > 0 ? "attention" : undefined}
          />
          <DashboardCompactMetricPill
            label="Heute"
            value={`${todayUpcomingReservations} · ${todayUpcomingGuests} Pers.`}
            onClick={() => setSheetMode("today_upcoming")}
            highlight={todayUpcomingReservations > 0}
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
      ) : null}

      {sheetMode ? (
        <DashboardReservationsListSheet
          open={sheetMode !== null}
          onOpenChange={(open) => {
            if (!open) setSheetMode(null);
          }}
          mode={sheetMode}
          rows={sheetRows}
          timeZone={restaurantTimeZone}
          description={sheetDescription}
        />
      ) : null}
    </DashboardWidgetShell>
  );
}
