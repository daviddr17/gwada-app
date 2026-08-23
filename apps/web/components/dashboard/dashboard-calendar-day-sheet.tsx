"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { OpeningHoursExceptionCard } from "@/components/settings/opening-hours-exception-card";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import type { DashboardCalendarDaySummary } from "@/lib/dashboard/dashboard-calendar-types";
import {
  newClosedCalendarException,
  newOpenCalendarException,
  removeCalendarDateException,
  upsertCalendarDateException,
} from "@/lib/dashboard/dashboard-calendar-hours-mutation";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { eventsOverviewDayHref } from "@/lib/events/private-event-href";
import { weekdayFromDateYmd } from "@/lib/opening-hours/embed-display-utils";
import { APP_SIGNAL_COLORS } from "@/lib/ui/app-signal-colors";
import {
  loadOpeningHoursForRestaurant,
} from "@/lib/supabase/opening-hours-db";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";
import { cn } from "@/lib/utils";

type DashboardCalendarDaySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  day: DashboardCalendarDaySummary | null;
  dayLabel: string | null;
  onHoursChanged?: () => void;
};

function SignalRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-2.5 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {color ? (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : null}
        <span className="truncate text-muted-foreground">{label}</span>
      </span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">
        {value}
      </span>
    </li>
  );
}

export function DashboardCalendarDaySheet({
  open,
  onOpenChange,
  restaurantId,
  day,
  dayLabel,
  onHoursChanged,
}: DashboardCalendarDaySheetProps) {
  const [savingHours, setSavingHours] = useState(false);
  const [hoursEditorOpen, setHoursEditorOpen] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<Record<Weekday, DayHours> | null>(
    null,
  );
  const [hoursDraft, setHoursDraft] = useState<DateHoursException | null>(null);

  useEffect(() => {
    if (!open) {
      setHoursEditorOpen(false);
      setHoursDraft(null);
      setWeeklyHours(null);
    }
  }, [open]);

  useEffect(() => {
    setHoursEditorOpen(false);
    setHoursDraft(null);
  }, [day?.date]);

  useEffect(() => {
    if (!open || !restaurantId || !hoursEditorOpen) return;
    let cancelled = false;
    void loadOpeningHoursForRestaurant(restaurantId).then((loaded) => {
      if (cancelled || !loaded || !day) return;
      setWeeklyHours(loaded.weeklyHours);
      const existing = loaded.dateExceptions.find((ex) => ex.date === day.date);
      if (existing) {
        setHoursDraft(existing);
        return;
      }
      const weekday = weekdayFromDateYmd(day.date);
      const weekdayHours = loaded.weeklyHours[weekday];
      setHoursDraft(
        newOpenCalendarException(day.date, null, {
          open: weekdayHours.closed ? "11:30" : weekdayHours.open,
          close: weekdayHours.closed ? "22:00" : weekdayHours.close,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId, hoursEditorOpen, day]);

  const saveException = async (exception: DateHoursException) => {
    if (!restaurantId) return;
    setSavingHours(true);
    try {
      const result = await upsertCalendarDateException(restaurantId, exception);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        exception.closed
          ? "Tag als geschlossen markiert."
          : "Sonderöffnungszeiten gespeichert.",
      );
      setHoursEditorOpen(false);
      setHoursDraft(null);
      onHoursChanged?.();
    } finally {
      setSavingHours(false);
    }
  };

  const clearException = async () => {
    if (!restaurantId || !day) return;
    setSavingHours(true);
    try {
      const result = await removeCalendarDateException(restaurantId, day.date);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sonderregel entfernt — Wochenplan gilt wieder.");
      setHoursEditorOpen(false);
      setHoursDraft(null);
      onHoursChanged?.();
    } finally {
      setSavingHours(false);
    }
  };

  const markClosed = async () => {
    if (!restaurantId || !day) return;
    const loaded = await loadOpeningHoursForRestaurant(restaurantId);
    const existing = loaded?.dateExceptions.find((ex) => ex.date === day.date);
    await saveException(newClosedCalendarException(day.date, existing));
  };

  const hoursSummary = useMemo(() => {
    if (!day?.hoursException) return "Regulärer Wochenplan";
    return day.hoursException.label;
  }, [day?.hoursException]);

  const reservationsHref = day
    ? `${APP_ROUTES.reservierungen.overview}?day=${encodeURIComponent(day.date)}`
    : APP_ROUTES.reservierungen.overview;
  const scheduleHref = day
    ? `${APP_ROUTES.mitarbeiter.schedule}?day=${encodeURIComponent(day.date)}`
    : APP_ROUTES.mitarbeiter.schedule;
  const eventsHref = day
    ? eventsOverviewDayHref(day.date)
    : APP_ROUTES.events.overview;
  const newsHref = APP_ROUTES.news.overview;
  const hoursHref = APP_ROUTES.settings.openingHours;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("info")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {dayLabel ?? "Tag"}
          </DrawerTitle>
          {day?.holidayName ? (
            <DrawerDescription className="text-base">
              Feiertag · {day.holidayName}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection title="Übersicht">
            {day ? (
              <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card">
                <SignalRow
                  label="Reservierungen"
                  value={String(day.reservationCount)}
                  color={APP_SIGNAL_COLORS.reservations}
                />
                <SignalRow
                  label="Veranstaltungen"
                  value={String(day.privateEventCount)}
                  color={APP_SIGNAL_COLORS.events}
                />
                <SignalRow
                  label="Mitarbeiter geplant"
                  value={String(day.plannedStaffCount)}
                  color={APP_SIGNAL_COLORS.staff}
                />
                <SignalRow
                  label="Geplante Posts"
                  value={String(day.scheduledNewsCount)}
                  color={APP_SIGNAL_COLORS.news}
                />
                <SignalRow label="Öffnung" value={hoursSummary} />
              </ul>
            ) : null}
          </DrawerFormSection>

          <DrawerFormSection title="Öffnungszeiten">
            {day && hoursEditorOpen && hoursDraft && weeklyHours ? (
              <div className="space-y-3">
                <OpeningHoursExceptionCard
                  exception={hoursDraft}
                  weeklyHours={weeklyHours}
                  onChange={(patch) =>
                    setHoursDraft((prev) =>
                      prev ? { ...prev, ...patch, date: day.date } : prev,
                    )
                  }
                  onRemove={() => void clearException()}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="lg"
                    className={cn(
                      "flex-1",
                      brandActionButtonRoundedClassName,
                    )}
                    disabled={savingHours || !restaurantId}
                    onClick={() => void saveException(hoursDraft)}
                  >
                    {savingHours ? "Speichern …" : "Speichern"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className={cn("flex-1", drawerFormFullWidthButtonClassName)}
                    disabled={savingHours}
                    onClick={() => {
                      setHoursEditorOpen(false);
                      setHoursDraft(null);
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : day ? (
              <div className="flex flex-col gap-2">
                {day.hoursException ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={drawerFormFullWidthButtonClassName}
                    disabled={savingHours || !restaurantId}
                    onClick={() => void clearException()}
                  >
                    {savingHours
                      ? "Speichern …"
                      : day.hoursException.closed
                        ? "Geschlossen aufheben"
                        : "Sonderzeiten entfernen"}
                  </Button>
                ) : null}
                {!day.hoursException?.closed ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className={drawerFormFullWidthButtonClassName}
                      disabled={savingHours || !restaurantId}
                      onClick={() => setHoursEditorOpen(true)}
                    >
                      {day.hoursException
                        ? "Sonderzeiten anpassen"
                        : "Sonderzeiten für Tag festlegen"}
                    </Button>
                    {!day.hoursException ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={drawerFormFullWidthButtonClassName}
                        disabled={savingHours || !restaurantId}
                        onClick={() => void markClosed()}
                      >
                        {savingHours ? "Speichern …" : "Tag geschlossen markieren"}
                      </Button>
                    ) : null}
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  render={
                    <AppNavLink
                      href={hoursHref}
                      onClick={() => onOpenChange(false)}
                    />
                  }
                >
                  Alle Öffnungszeiten in Einstellungen
                </Button>
              </div>
            ) : null}
          </DrawerFormSection>

          <DrawerFormSection title="Öffnen">
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                className={cn("h-10", brandActionButtonRoundedClassName)}
                render={
                  <AppNavLink
                    href={reservationsHref}
                    onClick={() => onOpenChange(false)}
                  />
                }
              >
                Reservierungen
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(drawerFormFullWidthButtonClassName, "h-10")}
                render={
                  <AppNavLink
                    href={scheduleHref}
                    onClick={() => onOpenChange(false)}
                  />
                }
              >
                Schichtplan
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(drawerFormFullWidthButtonClassName, "h-10")}
                render={
                  <AppNavLink
                    href={eventsHref}
                    onClick={() => onOpenChange(false)}
                  />
                }
              >
                Events
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(drawerFormFullWidthButtonClassName, "h-10")}
                render={
                  <AppNavLink
                    href={newsHref}
                    onClick={() => onOpenChange(false)}
                  />
                }
              >
                News
              </Button>
            </div>
          </DrawerFormSection>
        </div>

        <div className="shrink-0 border-t border-border/50 px-6 pb-6 pt-4">
          <Button
            type="button"
            variant="ghost"
            className={drawerFormFullWidthButtonClassName}
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
