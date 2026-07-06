"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  MessageCircle,
  Package,
  Sun,
  UserCheck,
} from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import {
  DashboardCompactList,
  DashboardCompactListItem,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
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
import { usePlatformWeatherAvailable } from "@/lib/hooks/use-platform-weather-available";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasDashboardWidgetAccess } from "@/lib/permissions/dashboard-widget-permissions";
import { reservationsUnconfirmedOverviewHref } from "@/lib/reservations/unconfirmed-reservations";
import { formatDashboardStaffTodayWorkLabel } from "@/lib/staff/compute-dashboard-staff-summary";
import { staffDisplayName } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_COLORS } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

const todayHeadingFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function formatReservationTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayYmd(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function HeuteStatCard({
  label,
  value,
  hint,
  href,
  onClick,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  tone?: "neutral" | "accent" | "attention" | "success" | "warning" | "break";
  icon?: ReactNode;
}) {
  const toneClass = {
    neutral: "border-border/50 bg-muted/15",
    accent: "border-accent/35 bg-accent/8",
    attention: "border-blue-500/35 bg-blue-500/8 dark:border-blue-400/30 dark:bg-blue-500/10",
    success: "border-emerald-500/35 bg-emerald-500/8 dark:border-emerald-400/30 dark:bg-emerald-500/10",
    warning: "border-amber-500/35 bg-amber-500/8 dark:border-amber-400/30 dark:bg-amber-500/10",
    break: "border-amber-400/35 bg-amber-400/8 dark:border-amber-300/25 dark:bg-amber-400/10",
  }[tone];

  const inner = (
    <>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon ? <span className="shrink-0 [&_svg]:size-3.5">{icon}</span> : null}
        {label}
      </span>
      <span className="mt-1 block text-lg font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </>
  );

  const className = cn(
    "rounded-xl border px-3 py-2.5 text-left transition-colors",
    toneClass,
    (href || onClick) &&
      "cursor-pointer hover:border-accent/45 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  if (href) {
    return (
      <AppNavLink href={href} prefetch={false} className={className}>
        {inner}
      </AppNavLink>
    );
  }

  return <div className={className}>{inner}</div>;
}

function HeuteSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-h-[12rem] rounded-xl border border-border/50 bg-card/60 p-3 shadow-none",
        className,
      )}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DashboardHeuteTileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="min-h-[12rem] rounded-xl" />
        <Skeleton className="min-h-[12rem] rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardHeuteTile() {
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const { available: weatherAvailable } = usePlatformWeatherAvailable();
  const reservations = useDashboardReservationStats();
  const staff = useDashboardStaffStats();
  const messages = useDashboardMessagesStats();
  const inventory = useDashboardInventoryStats();

  const [presenceSheetMode, setPresenceSheetMode] =
    useState<StaffLivePresenceSheetMode | null>(null);

  const accessOptions = {
    permissionsLoading,
    weatherAvailable,
    weatherLoading: false,
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

  const todayLabel = useMemo(() => todayHeadingFmt.format(new Date()), []);

  const todayReservations = useMemo(
    () => reservations.summary?.todayList ?? [],
    [reservations.summary],
  );

  const unconfirmedRecent = useMemo(
    () => reservations.summary?.unconfirmedList ?? [],
    [reservations.summary],
  );

  const staffById = useMemo(
    () => new Map(staff.staff.map((row) => [row.id, row] as const)),
    [staff.staff],
  );

  const workingStaff = useMemo(
    () =>
      staff.presence
        .filter((p) => p.status === "working")
        .map((p) => staffById.get(p.staff_id))
        .filter(Boolean)
        .slice(0, 6),
    [staff.presence, staffById],
  );

  const inventoryAlerts =
    (inventory.summary?.emptyStock ?? 0) > 0 ||
    (inventory.summary?.openOrders ?? 0) > 0;

  const reservationDayHref = `/dashboard/reservierungen/uebersicht?day=${todayYmd()}`;

  return (
    <DashboardWidgetShell
      title="Heute"
      description={todayLabel}
      variant="default"
      icon={
        <Sun className="size-5 shrink-0 text-amber-500/90" aria-hidden />
      }
      ready={ready}
      loading={showSkeleton}
      error={null}
      loadingContent={<DashboardHeuteTileSkeleton />}
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {can.reservations && reservations.summary ? (
            <>
              <HeuteStatCard
                label="Reservierungen"
                value={`${reservations.summary.todayReservations} · ${reservations.summary.todayGuests} Pers.`}
                hint="Heute im Restaurant"
                href={reservationDayHref}
                tone={
                  reservations.summary.todayReservations > 0 ? "accent" : "neutral"
                }
                icon={<CalendarDays aria-hidden />}
              />
              <HeuteStatCard
                label="Unbestätigt"
                value={String(reservations.summary.unconfirmedCount)}
                hint={
                  reservations.summary.unconfirmedCount > 0
                    ? "Bestätigung ausstehend"
                    : "Alles bestätigt"
                }
                href={
                  reservations.summary.unconfirmedCount > 0
                    ? reservationsUnconfirmedOverviewHref()
                    : undefined
                }
                tone={
                  reservations.summary.unconfirmedCount > 0 ? "attention" : "neutral"
                }
                icon={<AlertTriangle aria-hidden />}
              />
            </>
          ) : null}

          {can.staff && staff.summary ? (
            <>
              <HeuteStatCard
                label="Team aktiv"
                value={String(staff.summary.activeStaff)}
                hint={formatDashboardStaffTodayWorkLabel(staff.summary.todayWorkHours)}
                onClick={() => setPresenceSheetMode("working")}
                tone={staff.summary.activeStaff > 0 ? "success" : "neutral"}
                icon={<UserCheck aria-hidden />}
              />
              <HeuteStatCard
                label="In Pause"
                value={String(staff.summary.onBreakStaff)}
                hint="Display-Schicht"
                onClick={() => setPresenceSheetMode("on_break")}
                tone={staff.summary.onBreakStaff > 0 ? "break" : "neutral"}
                icon={<UserCheck aria-hidden />}
              />
            </>
          ) : null}

          {can.messages && messages.summary ? (
            <HeuteStatCard
              label="Nachrichten"
              value={String(messages.summary.total_unread)}
              hint={
                messages.summary.total_unread > 0
                  ? "Ungelesen — Antwort nötig"
                  : "Posteingang leer"
              }
              href={
                messages.summary.total_unread > 0
                  ? "/dashboard/kontakte/nachrichten?platform=all&read=unread"
                  : "/dashboard/kontakte/nachrichten?platform=all"
              }
              tone={messages.summary.total_unread > 0 ? "attention" : "neutral"}
              icon={<MessageCircle aria-hidden />}
            />
          ) : null}

          {can.inventory && inventory.summary && inventoryAlerts ? (
            <HeuteStatCard
              label="Bestand"
              value={`${inventory.summary.emptyStock} leer · ${inventory.summary.openOrders} offen`}
              hint="Zutaten oder Bestellungen prüfen"
              href="/dashboard/bestand/uebersicht"
              tone="warning"
              icon={<Package aria-hidden />}
            />
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {can.reservations ? (
            <HeuteSection title="Reservierungen heute">
              {todayReservations.length > 0 ? (
                <DashboardCompactList aria-label="Reservierungen heute">
                  {todayReservations.map((row) => (
                    <DashboardCompactListItem
                      key={row.id}
                      href={row.href}
                      title={row.guestLabel}
                      meta={`${row.partySize} Pers. · ${row.statusName}`}
                      trailing={formatReservationTime(row.startsAt)}
                      stripeVariant={row.unconfirmed ? "attention" : undefined}
                    />
                  ))}
                </DashboardCompactList>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {reservations.summary && reservations.summary.todayReservations > 0
                    ? "Weitere Reservierungen in der Übersicht."
                    : "Keine Reservierungen für heute."}
                </p>
              )}
            </HeuteSection>
          ) : null}

          <HeuteSection title="Aufmerksamkeit">
            <div className="space-y-3">
              {can.reservations && unconfirmedRecent.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    Unbestätigt
                  </p>
                  <DashboardCompactList aria-label="Unbestätigte Reservierungen">
                    {unconfirmedRecent.slice(0, 3).map((row) => (
                      <DashboardCompactListItem
                        key={row.id}
                        href={row.href}
                        title={row.guestLabel}
                        meta={`${row.partySize} Pers.`}
                        trailing={formatReservationTime(row.startsAt)}
                        stripeVariant="attention"
                      />
                    ))}
                  </DashboardCompactList>
                </div>
              ) : null}

              {can.messages && (messages.summary?.unread.length ?? 0) > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    Nachrichten
                  </p>
                  <DashboardCompactList aria-label="Ungelesene Nachrichten">
                    {messages.summary!.unread.slice(0, 3).map((row) => (
                      <DashboardCompactListItem
                        key={row.contactId}
                        href={row.href}
                        title={row.contactName}
                        meta={row.preview}
                        stripeVariant="attention"
                      />
                    ))}
                  </DashboardCompactList>
                </div>
              ) : null}

              {can.staff && workingStaff.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Gerade im Einsatz
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {workingStaff.map((member) => (
                      <li
                        key={member!.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: STAFF_WORK_ENTRY_COLORS.work }}
                          aria-hidden
                        />
                        {staffDisplayName(member!)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!can.reservations &&
              !can.messages &&
              !can.staff &&
              !can.inventory ? (
                <p className="text-sm text-muted-foreground">
                  Keine Berechtigung für Tagesmodule.
                </p>
              ) : null}

              {can.reservations &&
              can.messages &&
              can.staff &&
              unconfirmedRecent.length === 0 &&
              (messages.summary?.unread.length ?? 0) === 0 &&
              workingStaff.length === 0 &&
              !inventoryAlerts ? (
                <p className="text-sm text-muted-foreground">
                  Alles ruhig — keine offenen Punkte.
                </p>
              ) : null}
            </div>
          </HeuteSection>
        </div>
      </div>

      {presenceSheetMode ? (
        <StaffOverviewLivePresenceSheet
          open={presenceSheetMode !== null}
          onOpenChange={(open) => {
            if (!open) setPresenceSheetMode(null);
          }}
          mode={presenceSheetMode}
          presence={staff.presence}
          staffById={staffById}
        />
      ) : null}
    </DashboardWidgetShell>
  );
}
