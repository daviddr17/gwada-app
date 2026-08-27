"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  ChevronRight,
  Clock,
  MessageCircle,
  Package,
  Sun,
  UserCheck,
} from "lucide-react";
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

type HeuteActionTone = "attention" | "warning" | "birthday";

const ACTION_TONE_STRIPE: Record<HeuteActionTone, string> = {
  attention: "bg-blue-500",
  warning: "bg-amber-500",
  birthday: "bg-pink-500",
};

const ACTION_TONE_SHELL: Record<HeuteActionTone, string> = {
  attention:
    "border-blue-500/35 bg-blue-500/[0.07] hover:bg-blue-500/[0.11] dark:border-blue-400/30 dark:bg-blue-500/10 dark:hover:bg-blue-500/15",
  warning:
    "border-amber-500/40 bg-amber-500/[0.08] hover:bg-amber-500/[0.12] dark:border-amber-400/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15",
  birthday:
    "border-pink-500/35 bg-pink-500/[0.07] hover:bg-pink-500/[0.11] dark:border-pink-400/30 dark:bg-pink-500/10 dark:hover:bg-pink-500/15",
};

type HeuteActionItem = {
  id: string;
  title: string;
  meta: string;
  tone: HeuteActionTone;
  icon: ReactNode;
  onClick: () => void;
};

type HeuteLageItem = {
  id: string;
  label: string;
  value: string;
  meta: string;
  icon: ReactNode;
  onClick: () => void;
  emphasize?: boolean;
};

function HeuteSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h3>
  );
}

function HeuteActionRow({ item }: { item: HeuteActionItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={cn(
        "flex w-full min-h-12 items-stretch gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors sm:min-h-14 sm:gap-3 sm:px-3 sm:py-3",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        ACTION_TONE_SHELL[item.tone],
      )}
    >
      <span
        className={cn(
          "w-1 shrink-0 self-stretch rounded-full",
          ACTION_TONE_STRIPE[item.tone],
        )}
        aria-hidden
      />
      <span className="flex size-8 shrink-0 items-center justify-center self-center rounded-lg bg-background/60 text-muted-foreground sm:size-9 [&_svg]:size-4">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 self-center">
        <span className="block text-sm font-semibold leading-snug text-foreground sm:text-[0.9375rem]">
          {item.title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {item.meta}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 self-center text-muted-foreground/70"
        aria-hidden
      />
    </button>
  );
}

function HeuteLageTile({ item }: { item: HeuteLageItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={cn(
        "flex min-h-[4.75rem] w-full flex-col justify-between rounded-xl border border-border/50 bg-background/65 p-3 text-left transition-colors",
        "hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "sm:min-h-[5.25rem] sm:p-3.5",
        item.emphasize &&
          "border-accent/40 bg-accent/[0.07] shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--accent)_20%,transparent)]",
      )}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="[&_svg]:size-3.5">{item.icon}</span>
        {item.label}
      </span>
      <span className="mt-2">
        <span className="block text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {item.value}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {item.meta}
        </span>
      </span>
    </button>
  );
}

function DashboardHeuteTileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Skeleton className="h-[5rem] w-full rounded-xl" />
          <Skeleton className="h-[5rem] w-full rounded-xl" />
          <Skeleton className="h-[5rem] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function pluralDe(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
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
  const [workHoursSheetOpen, setWorkHoursSheetOpen] = useState(false);
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

  const unreadMessages = useMemo(
    () => (can.messages ? messages.summary?.unread ?? [] : []),
    [can.messages, messages.summary],
  );

  const staffById = useMemo(
    () => new Map(staff.staff.map((row) => [row.id, row] as const)),
    [staff.staff],
  );

  const unconfirmedCount = can.reservations
    ? (reservations.summary?.unconfirmedCount ?? 0)
    : 0;
  const unreadMessageCount = can.messages
    ? (messages.summary?.total_unread ?? 0)
    : 0;

  const staffTodayYmd = restaurantTodayYmd(restaurantTimeZone);
  const todayWorkHours = staff.summary?.todayWorkHours ?? 0;
  const todayUpcomingReservations =
    reservations.summary?.todayUpcomingReservations ?? 0;
  const todayUpcomingGuests = reservations.summary?.todayUpcomingGuests ?? 0;
  const activeStaff = staff.summary?.activeStaff ?? 0;
  const completedShiftsToday = staff.summary?.completedShiftsToday ?? 0;

  const deliveriesDueToday = inventory.summary?.deliveriesDueToday ?? 0;
  const deliveriesOverdue = inventory.summary?.deliveriesOverdue ?? 0;
  const emptyStock = inventory.summary?.emptyStock ?? 0;
  const openOrders = inventory.summary?.openOrders ?? 0;
  const deliveryDueTotal = deliveriesDueToday + deliveriesOverdue;
  const inventoryOtherAlerts = emptyStock > 0 || openOrders > 0;

  const birthdaysToday = useMemo(
    () =>
      can.staff ? listStaffBirthdaysToday(staff.staff, staffTodayYmd) : [],
    [can.staff, staff.staff, staffTodayYmd],
  );

  const actionItems = useMemo((): HeuteActionItem[] => {
    const items: HeuteActionItem[] = [];

    if (can.reservations && unconfirmedCount > 0) {
      items.push({
        id: "reservations-unconfirmed",
        title: `${unconfirmedCount} ${pluralDe(
          unconfirmedCount,
          "Reservierung wartet",
          "Reservierungen warten",
        )} auf Bestätigung`,
        meta: "Sofort prüfen",
        tone: "attention",
        icon: <AlertTriangle aria-hidden />,
        onClick: () => setReservationSheetMode("unconfirmed"),
      });
    }

    if (can.messages && unreadMessageCount > 0) {
      items.push({
        id: "messages-unread",
        title: `${unreadMessageCount} ${pluralDe(
          unreadMessageCount,
          "ungelesene Nachricht",
          "ungelesene Nachrichten",
        )}`,
        meta: "Gäste warten auf Antwort",
        tone: "attention",
        icon: <MessageCircle aria-hidden />,
        onClick: () => setMessagesSheetOpen(true),
      });
    }

    if (can.inventory && deliveryDueTotal > 0) {
      const parts: string[] = [];
      if (deliveriesOverdue > 0) {
        parts.push(
          `${deliveriesOverdue} ${pluralDe(
            deliveriesOverdue,
            "Lieferung überfällig",
            "Lieferungen überfällig",
          )}`,
        );
      }
      if (deliveriesDueToday > 0) {
        parts.push(
          `${deliveriesDueToday} ${pluralDe(
            deliveriesDueToday,
            "Lieferung heute",
            "Lieferungen heute",
          )}`,
        );
      }
      items.push({
        id: "inventory-delivery",
        title: parts.join(" · "),
        meta: "Lieferung prüfen und Bestellung abschließen",
        tone: "warning",
        icon: <Package aria-hidden />,
        onClick: () => setInventorySheetOpen(true),
      });
    } else if (can.inventory && inventoryOtherAlerts) {
      const parts: string[] = [];
      if (emptyStock > 0) {
        parts.push(
          `${emptyStock} ${pluralDe(emptyStock, "Zutat leer", "Zutaten leer")}`,
        );
      }
      if (openOrders > 0) {
        parts.push(
          `${openOrders} ${pluralDe(
            openOrders,
            "Bestellung offen",
            "Bestellungen offen",
          )}`,
        );
      }
      items.push({
        id: "inventory-alerts",
        title: parts.join(" · "),
        meta: "Bestand prüfen",
        tone: "warning",
        icon: <Package aria-hidden />,
        onClick: () => setInventorySheetOpen(true),
      });
    }

    if (birthdaysToday.length > 0) {
      items.push({
        id: "birthdays",
        title: `${birthdaysToday.length} ${pluralDe(
          birthdaysToday.length,
          "Geburtstag heute",
          "Geburtstage heute",
        )}`,
        meta: birthdaysToday
          .slice(0, 2)
          .map((b) => b.name)
          .join(", "),
        tone: "birthday",
        icon: <Cake aria-hidden />,
        onClick: () => setBirthdaysSheetOpen(true),
      });
    }

    return items;
  }, [
    birthdaysToday,
    can.inventory,
    can.messages,
    can.reservations,
    deliveriesDueToday,
    deliveriesOverdue,
    deliveryDueTotal,
    emptyStock,
    inventoryOtherAlerts,
    openOrders,
    unconfirmedCount,
    unreadMessageCount,
  ]);

  const lageItems = useMemo((): HeuteLageItem[] => {
    const items: HeuteLageItem[] = [];

    if (can.reservations && reservations.summary) {
      items.push({
        id: "reservations-today",
        label: "Reservierungen",
        value: String(todayUpcomingReservations),
        meta:
          todayUpcomingReservations > 0
            ? `${todayUpcomingGuests} ${pluralDe(
                todayUpcomingGuests,
                "Person",
                "Personen",
              )} heute`
            : "Keine weiteren heute",
        icon: <CalendarDays aria-hidden />,
        onClick: () => setReservationSheetMode("today_upcoming"),
        emphasize: todayUpcomingReservations > 0,
      });
    }

    if (can.staff && staff.summary) {
      items.push({
        id: "team",
        label: "Team",
        value: String(activeStaff),
        meta:
          completedShiftsToday > 0
            ? `${pluralDe(activeStaff, "aktiv", "aktiv")} · ${completedShiftsToday} fertig`
            : activeStaff > 0
              ? "Jetzt im Haus"
              : "Niemand eingeloggt",
        icon: <UserCheck aria-hidden />,
        onClick: () => setPresenceSheetMode("working"),
        emphasize: activeStaff > 0,
      });
      items.push({
        id: "hours",
        label: "Arbeitszeit",
        value: todayWorkHours > 0 ? formatHoursDe(todayWorkHours) : "0 h",
        meta: "Heute erfasst",
        icon: <Clock aria-hidden />,
        onClick: () => setWorkHoursSheetOpen(true),
        emphasize: todayWorkHours > 0,
      });
    }

    return items;
  }, [
    activeStaff,
    can.reservations,
    can.staff,
    completedShiftsToday,
    reservations.summary,
    staff.summary,
    todayUpcomingGuests,
    todayUpcomingReservations,
    todayWorkHours,
  ]);

  const hasActions = actionItems.length > 0;
  const hasLage = lageItems.length > 0;

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
      <div
        className={cn(
          "flex flex-col gap-4 sm:gap-5",
          hasActions && hasLage && "xl:grid xl:grid-cols-12 xl:items-start xl:gap-5",
        )}
      >
        {hasActions ? (
          <section
            className={cn("min-w-0 space-y-2", hasLage && "xl:col-span-7")}
            aria-label="Jetzt handeln"
          >
            <HeuteSectionLabel>Jetzt handeln</HeuteSectionLabel>
            <div className="flex flex-col gap-2">
              {actionItems.map((item) => (
                <HeuteActionRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {hasLage ? (
          <section
            className={cn(
              "min-w-0 space-y-2",
              hasActions && "xl:col-span-5",
            )}
            aria-label="Heute läuft"
          >
            <HeuteSectionLabel>Heute läuft</HeuteSectionLabel>
            <div
              className={cn(
                "grid gap-2",
                // Phone: 1 Spalte; Tablet+: bis 3; neben Aktionen auf XL: wieder 1 Spalte
                lageItems.length === 1 && "grid-cols-1",
                lageItems.length === 2 && "grid-cols-1 sm:grid-cols-2",
                lageItems.length >= 3 &&
                  (hasActions
                    ? "grid-cols-1 sm:grid-cols-3 xl:grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-3"),
              )}
            >
              {lageItems.map((item) => (
                <HeuteLageTile key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {!hasActions && !hasLage ? (
          <p className="py-2 text-sm text-muted-foreground">
            Keine Module freigeschaltet — sobald Reservierungen, Team oder
            Nachrichten verfügbar sind, erscheint hier dein Tagesüberblick.
          </p>
        ) : null}
      </div>

      <DashboardHeuteLiveTimeline className="mt-4" />

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
