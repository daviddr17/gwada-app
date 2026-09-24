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
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { ReservationInternalNoteFinePrint } from "@/components/reservations/reservation-internal-note-indicator";
import { dashboardTodayUpcomingPreview } from "@/lib/dashboard/dashboard-reservation-today-preview";
import { useDashboardReservationStats } from "@/lib/hooks/use-dashboard-reservation-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { formatReservationTimeInRestaurantTz } from "@/lib/restaurant/restaurant-timezone";
import type { DashboardReservationRecent } from "@/lib/reservations/compute-dashboard-reservation-summary";

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
  const todayPreview = dashboardTodayUpcomingPreview(
    summary?.todayUpcomingList ?? [],
  );

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
        <div className="space-y-2">
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
          {todayPreview.preview.length > 0 ? (
            <ul className="space-y-0.5" aria-label="Anstehende Reservierungen heute">
              {todayPreview.preview.map((row) => (
                <DashboardReservationDayPreviewRow
                  key={row.id}
                  row={row}
                  timeZone={restaurantTimeZone}
                />
              ))}
            </ul>
          ) : null}
          {todayPreview.showAll ? (
            <button
              type="button"
              onClick={() => setSheetMode("today_upcoming")}
              className="px-1 text-left text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Alle anzeigen
            </button>
          ) : null}
        </div>
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

function DashboardReservationDayPreviewRow({
  row,
  timeZone,
}: {
  row: DashboardReservationRecent;
  timeZone: string;
}) {
  return (
    <li>
      <AppNavLink
        href={row.href}
        prefetch={false}
        className="flex min-w-0 items-baseline gap-2 rounded-md px-1 py-0.5 text-xs hover:bg-muted/40"
      >
        <span className="w-11 shrink-0 tabular-nums font-medium text-foreground">
          {formatReservationTimeInRestaurantTz(row.startsAt, timeZone)}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {row.guestLabel}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {row.partySize} Pers.
        </span>
      </AppNavLink>
      {row.internalNote ? (
        <ReservationInternalNoteFinePrint
          note={row.internalNote}
          className="px-1"
        />
      ) : null}
    </li>
  );
}
