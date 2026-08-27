"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Cake,
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  Sun,
  UserCheck,
} from "lucide-react";
import { DashboardCompactInlineMetrics } from "@/components/dashboard/dashboard-compact-list";
import { DashboardHeuteAufmerksamkeitSheet } from "@/components/dashboard/dashboard-heute-aufmerksamkeit-sheet";
import { DashboardHeuteBirthdaysSheet } from "@/components/dashboard/dashboard-heute-birthdays-sheet";
import { DashboardHeuteWorkHoursSheet } from "@/components/dashboard/dashboard-heute-work-hours-sheet";
import { DashboardInventoryAlertsSheet } from "@/components/dashboard/dashboard-inventory-alerts-sheet";
import { DashboardMessagesListSheet } from "@/components/dashboard/dashboard-messages-list-sheet";
import {
  DashboardReservationsListSheet,
  type DashboardReservationsListSheetMode,
} from "@/components/dashboard/dashboard-reservations-list-sheet";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { DashboardHeuteLiveTimeline } from "@/components/dashboard/dashboard-heute-live-timeline";
import {
  StaffOverviewLivePresenceSheet,
  type StaffLivePresenceSheetMode,
} from "@/components/staff/staff-overview-live-presence-sheet";
import { StaffOverviewCompletedShiftsSheet } from "@/components/staff/staff-overview-completed-shifts-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardInventoryStats } from "@/lib/hooks/use-dashboard-inventory-stats";
import { useDashboardMessagesStats } from "@/lib/hooks/use-dashboard-messages-stats";
import { useDashboardReservationStats } from "@/lib/hooks/use-dashboard-reservation-stats";
import { useDashboardStaffStats } from "@/lib/hooks/use-dashboard-staff-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantBilling } from "@/lib/contexts/restaurant-billing-context";
import { usePlatformWeatherAvailable } from "@/lib/hooks/use-platform-weather-available";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  createRestaurantDateTimeFormatter,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasDashboardWidgetAccess } from "@/lib/permissions/dashboard-widget-permissions";
import { listStaffBirthdaysToday } from "@/lib/staff/staff-birthdays-today";
import { formatHoursDe } from "@/lib/staff/staff-work-hours-summary";
import { cn } from "@/lib/utils";

type HeuteMetricTone =
  | "neutral"
  | "accent"
  | "attention"
  | "success"
  | "warning"
  | "break"
  | "birthday";

const HEUTE_METRIC_TONE_CLASS: Record<HeuteMetricTone, string> = {
  neutral: "border-border/50 bg-background/70",
  accent:
    "border-accent/45 bg-accent/12 shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--accent)_25%,transparent)]",
  attention:
    "border-blue-500/40 bg-blue-500/12 dark:border-blue-400/35 dark:bg-blue-500/15",
  success:
    "border-emerald-500/40 bg-emerald-500/12 dark:border-emerald-400/35 dark:bg-emerald-500/15",
  warning:
    "border-amber-500/45 bg-amber-500/14 dark:border-amber-400/35 dark:bg-amber-500/15",
  break:
    "border-amber-400/40 bg-amber-400/12 dark:border-amber-300/30 dark:bg-amber-400/12",
  birthday:
    "border-pink-500/40 bg-pink-500/12 dark:border-pink-400/35 dark:bg-pink-500/15",
};

const HEUTE_METRIC_VALUE_CLASS: Record<HeuteMetricTone, string> = {
  neutral: "text-foreground",
  accent: "text-foreground",
  attention: "text-blue-700 dark:text-blue-300",
  success: "text-emerald-800 dark:text-emerald-300",
  warning: "text-amber-800 dark:text-amber-300",
  break: "text-amber-800 dark:text-amber-200",
  birthday: "text-pink-800 dark:text-pink-300",
};

function HeuteMetricPill({
  label,
  value,
  onClick,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  onClick: () => void;
  tone?: HeuteMetricTone;
  icon?: ReactNode;
}) {
  const shellClass = cn(
    "inline-flex min-w-0 rounded-lg border text-left transition-colors",
    HEUTE_METRIC_TONE_CLASS[tone],
    "cursor-pointer hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  const content = (
    <div className="flex min-w-0 items-center gap-1.5 px-2 py-1">
      {icon ? (
        <span className="shrink-0 text-muted-foreground [&_svg]:size-3">{icon}</span>
      ) : null}
      <div className="min-w-0">
        <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "block truncate text-xs font-semibold tabular-nums leading-tight",
            HEUTE_METRIC_VALUE_CLASS[tone],
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );

  return (
    <button type="button" onClick={onClick} className={shellClass}>
      {content}
    </button>
  );
}

function DashboardHeuteTileSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[5.25rem] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DashboardHeuteTile() {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const { entitlements } = useRestaurantBilling();
  const { available: weatherAvailable } = usePlatformWeatherAvailable();
  const reservations = useDashboardReservationStats();
  const staff = useDashboardStaffStats();
  const messages = useDashboardMessagesStats();
  const inventory = useDashboardInventoryStats();

  const [reservationSheetMode, setReservationSheetMode] =
    useState<DashboardReservationsListSheetMode | null>(null);
  const [presenceSheetMode, setPresenceSheetMode] =
    useState<StaffLivePresenceSheetMode | null>(null);
  const [completedSheetOpen, setCompletedSheetOpen] = useState(false);
  const [workHoursSheetOpen, setWorkHoursSheetOpen] = useState(false);
  const [aufmerksamkeitSheetOpen, setAufmerksamkeitSheetOpen] = useState(false);
  const [messagesSheetOpen, setMessagesSheetOpen] = useState(false);
  const [inventorySheetOpen, setInventorySheetOpen] = useState(false);
  const [birthdaysSheetOpen, setBirthdaysSheetOpen] = useState(false);

  const accessOptions = {
    permissionsLoading,
    weatherAvailable,
    weatherLoading: false,
    entitlements,
  };

  const can = {
    reservations: hasDashboardWidgetAccess(has, "reservations", accessOptions),
    staff: hasDashboardWidgetAccess(has, "staff", accessOptions),
    messages: hasDashboardWidgetAccess(has, "messages", accessOptions),
    inventory: hasDashboardWidgetAccess(has, "inventory", accessOptions),
  };

  const ready =
    reservations.ready ||
    staff.ready ||
    messages.ready ||
    inventory.ready;

  const loading =
    (reservations.loading && !reservations.summary) ||
    (staff.loading && !staff.summary) ||
    (messages.loading && !messages.summary) ||
    (inventory.loading && !inventory.summary);

  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const todayLabel = useMemo(
    () =>
      createRestaurantDateTimeFormatter(restaurantTimeZone, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [restaurantTimeZone],
  );

  const unconfirmedRecent = useMemo(
    () => (can.reservations ? reservations.summary?.unconfirmedList ?? [] : []),
    [can.reservations, reservations.summary],
  );

  const unreadMessages = useMemo(
    () => (can.messages ? messages.summary?.unread ?? [] : []),
    [can.messages, messages.summary],
  );

  const staffById = useMemo(
    () => new Map(staff.staff.map((row) => [row.id, row] as const)),
    [staff.staff],
  );

  const inventoryAlerts =
    (inventory.summary?.emptyStock ?? 0) > 0 ||
    (inventory.summary?.openOrders ?? 0) > 0 ||
    (inventory.summary?.deliveriesDueToday ?? 0) > 0 ||
    (inventory.summary?.deliveriesOverdue ?? 0) > 0;

  const canShowAufmerksamkeit = can.reservations || can.messages;
  const unconfirmedCount = can.reservations
    ? (reservations.summary?.unconfirmedCount ?? 0)
    : 0;
  const unreadMessageCount = can.messages
    ? (messages.summary?.total_unread ?? 0)
    : 0;
  const aufmerksamkeitCount = unconfirmedCount + unreadMessageCount;

  const staffTodayYmd = restaurantTodayYmd(restaurantTimeZone);
  const todayWorkHours = staff.summary?.todayWorkHours ?? 0;
  const todayUpcomingReservations =
    reservations.summary?.todayUpcomingReservations ?? 0;
  const todayUpcomingGuests = reservations.summary?.todayUpcomingGuests ?? 0;

  const birthdaysToday = useMemo(
    () =>
      can.staff ? listStaffBirthdaysToday(staff.staff, staffTodayYmd) : [],
    [can.staff, staff.staff, staffTodayYmd],
  );

  return (
    <DashboardWidgetShell
      title="Heute"
      description={todayLabel}
      variant="compact"
      cardClassName="border-border/40 shadow-sm"
      background={
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-accent/8 to-transparent dark:from-amber-400/12 dark:via-accent/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
            aria-hidden
          />
        </>
      }
      icon={
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
          <Sun className="size-4" aria-hidden />
        </span>
      }
      ready={ready}
      loading={showSkeleton}
      error={null}
      loadingContent={<DashboardHeuteTileSkeleton />}
    >
      <DashboardCompactInlineMetrics className="gap-1.5">
        {/* Aufmerksamkeit zuerst — unbestätigt / ungelesen vor Tagesstatistik */}
        {canShowAufmerksamkeit ? (
          <HeuteMetricPill
            label="Achtung"
            value={String(aufmerksamkeitCount)}
            onClick={() => setAufmerksamkeitSheetOpen(true)}
            tone={aufmerksamkeitCount > 0 ? "attention" : "neutral"}
            icon={<Bell aria-hidden />}
          />
        ) : null}

        {can.reservations && reservations.summary ? (
          <>
            <HeuteMetricPill
              label="Unbest."
              value={String(reservations.summary.unconfirmedCount)}
              onClick={() => setReservationSheetMode("unconfirmed")}
              tone={
                reservations.summary.unconfirmedCount > 0 ? "attention" : "neutral"
              }
              icon={<AlertTriangle aria-hidden />}
            />
            <HeuteMetricPill
              label="Heute"
              value={`${todayUpcomingReservations} · ${todayUpcomingGuests} P.`}
              onClick={() => setReservationSheetMode("today_upcoming")}
              tone={todayUpcomingReservations > 0 ? "accent" : "neutral"}
              icon={<CalendarDays aria-hidden />}
            />
          </>
        ) : null}

        {can.messages && messages.summary ? (
          <HeuteMetricPill
            label="Chats"
            value={String(messages.summary.total_unread)}
            onClick={() => setMessagesSheetOpen(true)}
            tone={messages.summary.total_unread > 0 ? "attention" : "neutral"}
            icon={<MessageCircle aria-hidden />}
          />
        ) : null}

        {can.staff && staff.summary ? (
          <>
            {birthdaysToday.length > 0 ? (
              <HeuteMetricPill
                label="Geburt"
                value={String(birthdaysToday.length)}
                onClick={() => setBirthdaysSheetOpen(true)}
                tone="birthday"
                icon={<Cake aria-hidden />}
              />
            ) : null}
            <HeuteMetricPill
              label="Team"
              value={String(staff.summary.activeStaff)}
              onClick={() => setPresenceSheetMode("working")}
              tone={staff.summary.activeStaff > 0 ? "success" : "neutral"}
              icon={<UserCheck aria-hidden />}
            />
            <HeuteMetricPill
              label="Fertig"
              value={String(staff.summary.completedShiftsToday)}
              onClick={() => setCompletedSheetOpen(true)}
              tone={staff.summary.completedShiftsToday > 0 ? "success" : "neutral"}
              icon={<CheckCircle2 aria-hidden />}
            />
            <HeuteMetricPill
              label="Std."
              value={todayWorkHours > 0 ? formatHoursDe(todayWorkHours) : "0 h"}
              onClick={() => setWorkHoursSheetOpen(true)}
              tone={todayWorkHours > 0 ? "accent" : "neutral"}
              icon={<Clock aria-hidden />}
            />
          </>
        ) : null}

        {can.inventory && inventory.summary && inventoryAlerts ? (
          <HeuteMetricPill
            label="Bestand"
            value={
              (inventory.summary.deliveriesOverdue ?? 0) > 0 ||
              (inventory.summary.deliveriesDueToday ?? 0) > 0
                ? [
                    (inventory.summary.deliveriesOverdue ?? 0) > 0
                      ? `${inventory.summary.deliveriesOverdue} überfällig`
                      : null,
                    (inventory.summary.deliveriesDueToday ?? 0) > 0
                      ? `${inventory.summary.deliveriesDueToday} Lieferung`
                      : null,
                    inventory.summary.emptyStock > 0 ||
                    inventory.summary.openOrders > 0
                      ? `${inventory.summary.emptyStock} · ${inventory.summary.openOrders}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : `${inventory.summary.emptyStock} · ${inventory.summary.openOrders}`
            }
            onClick={() => setInventorySheetOpen(true)}
            tone="warning"
            icon={<Package aria-hidden />}
          />
        ) : null}
      </DashboardCompactInlineMetrics>

      <DashboardHeuteLiveTimeline className="mt-3" />

      {reservationSheetMode && can.reservations && reservations.summary ? (
        <DashboardReservationsListSheet
          open={reservationSheetMode !== null}
          onOpenChange={(open) => {
            if (!open) setReservationSheetMode(null);
          }}
          mode={reservationSheetMode}
          rows={
            reservationSheetMode === "today_upcoming"
              ? (reservations.summary.todayUpcomingList ?? [])
              : (reservations.summary.unconfirmedList ?? [])
          }
          timeZone={restaurantTimeZone}
          description={
            reservationSheetMode === "today_upcoming"
              ? `${todayUpcomingReservations} Reservierungen · ${todayUpcomingGuests} Personen`
              : `${reservations.summary.unconfirmedCount} offen`
          }
        />
      ) : null}

      {presenceSheetMode ? (
        <StaffOverviewLivePresenceSheet
          open={presenceSheetMode !== null}
          onOpenChange={(open) => {
            if (!open) setPresenceSheetMode(null);
          }}
          mode={presenceSheetMode}
          presence={staff.presence}
          staffById={staffById}
          timeZone={restaurantTimeZone}
        />
      ) : null}

      {completedSheetOpen ? (
        <StaffOverviewCompletedShiftsSheet
          open={completedSheetOpen}
          onOpenChange={setCompletedSheetOpen}
          dayYmd={staffTodayYmd}
          shifts={staff.completedShifts}
          staffById={staffById}
          timeZone={restaurantTimeZone}
        />
      ) : null}

      {workHoursSheetOpen ? (
        <DashboardHeuteWorkHoursSheet
          open={workHoursSheetOpen}
          onOpenChange={setWorkHoursSheetOpen}
          dayYmd={staffTodayYmd}
          todayWorkHours={todayWorkHours}
          presence={staff.presence}
          completedShifts={staff.completedShifts}
          staffById={staffById}
          wageBreakdown={staff.wageBreakdown}
          timeZone={restaurantTimeZone}
        />
      ) : null}

      {aufmerksamkeitSheetOpen ? (
        <DashboardHeuteAufmerksamkeitSheet
          open={aufmerksamkeitSheetOpen}
          onOpenChange={setAufmerksamkeitSheetOpen}
          unconfirmedReservations={unconfirmedRecent}
          unreadMessages={unreadMessages}
          unconfirmedCount={unconfirmedCount}
          unreadMessageCount={unreadMessageCount}
          timeZone={restaurantTimeZone}
        />
      ) : null}

      {messagesSheetOpen && can.messages && messages.summary ? (
        <DashboardMessagesListSheet
          open={messagesSheetOpen}
          onOpenChange={setMessagesSheetOpen}
          rows={unreadMessages}
          totalUnread={messages.summary.total_unread}
          timeZone={restaurantTimeZone}
        />
      ) : null}

      {birthdaysSheetOpen && can.staff ? (
        <DashboardHeuteBirthdaysSheet
          open={birthdaysSheetOpen}
          onOpenChange={setBirthdaysSheetOpen}
          birthdays={birthdaysToday}
          dayLabel={todayLabel}
        />
      ) : null}

      {inventorySheetOpen && can.inventory && inventory.summary ? (
        <DashboardInventoryAlertsSheet
          open={inventorySheetOpen}
          onOpenChange={setInventorySheetOpen}
          emptyStockCount={inventory.summary.emptyStock}
          openOrdersCount={inventory.summary.openOrders}
          openOrderLinesCount={inventory.summary.openOrderLines}
          deliveriesDueTodayCount={inventory.summary.deliveriesDueToday ?? 0}
          deliveriesOverdueCount={inventory.summary.deliveriesOverdue ?? 0}
          todayYmd={staffTodayYmd}
        />
      ) : null}
    </DashboardWidgetShell>
  );
}
