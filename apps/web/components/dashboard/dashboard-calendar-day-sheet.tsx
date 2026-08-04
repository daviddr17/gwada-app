"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppNavLink } from "@/components/navigation/app-nav-link";
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
import { PRIVATE_EVENT_STRIPE_HEX } from "@/lib/reservations/reservation-kind";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  loadOpeningHoursForRestaurant,
  replaceOpeningHoursForRestaurant,
} from "@/lib/supabase/opening-hours-db";
import type { DateHoursException } from "@/lib/types/restaurant";
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
  const [savingClosed, setSavingClosed] = useState(false);

  const markClosed = async () => {
    if (!restaurantId || !day) return;
    setSavingClosed(true);
    try {
      const loaded = await loadOpeningHoursForRestaurant(restaurantId);
      if (!loaded) {
        toast.error("Öffnungszeiten konnten nicht geladen werden.");
        return;
      }
      const nextException: DateHoursException = {
        id:
          loaded.dateExceptions.find((ex) => ex.date === day.date)?.id ??
          crypto.randomUUID(),
        date: day.date,
        closed: true,
        note:
          loaded.dateExceptions.find((ex) => ex.date === day.date)?.note ??
          "Geschlossen (Dashboard)",
      };
      const dateExceptions = [
        ...loaded.dateExceptions.filter((ex) => ex.date !== day.date),
        nextException,
      ].sort((a, b) => a.date.localeCompare(b.date));
      const result = await replaceOpeningHoursForRestaurant(restaurantId, {
        weeklyHours: loaded.weeklyHours,
        dateExceptions,
        kitchenHoursEnabled: loaded.kitchenHoursEnabled,
        kitchenWeeklyHours: loaded.kitchenWeeklyHours,
      });
      if (!result.ok) {
        toast.error(result.error || "Speichern fehlgeschlagen.");
        return;
      }
      toast.success("Tag als geschlossen markiert.");
      onHoursChanged?.();
    } finally {
      setSavingClosed(false);
    }
  };

  const reservationsHref = day
    ? `${APP_ROUTES.reservierungen.overview}?day=${encodeURIComponent(day.date)}`
    : APP_ROUTES.reservierungen.overview;
  const scheduleHref = day
    ? `${APP_ROUTES.mitarbeiter.schedule}?day=${encodeURIComponent(day.date)}`
    : APP_ROUTES.mitarbeiter.schedule;
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
                  color="var(--accent)"
                />
                <SignalRow
                  label="Veranstaltungen"
                  value={String(day.privateEventCount)}
                  color={PRIVATE_EVENT_STRIPE_HEX}
                />
                <SignalRow
                  label="Mitarbeiter geplant"
                  value={String(day.plannedStaffCount)}
                  color="#64748b"
                />
                <SignalRow
                  label="Geplante Posts"
                  value={String(day.scheduledNewsCount)}
                  color="#059669"
                />
                {day.hoursException ? (
                  <SignalRow
                    label="Sonderöffnungszeiten"
                    value={day.hoursException.label}
                    color={day.hoursException.closed ? "#dc2626" : "#ea580c"}
                  />
                ) : (
                  <SignalRow
                    label="Sonderöffnungszeiten"
                    value="—"
                    color="#ea580c"
                  />
                )}
              </ul>
            ) : null}
          </DrawerFormSection>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/50 px-6 pb-6 pt-4">
          <Button
            size="lg"
            className={cn("h-11 w-full", brandActionButtonRoundedClassName)}
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
            className={drawerFormFullWidthButtonClassName}
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
            className={drawerFormFullWidthButtonClassName}
            render={
              <AppNavLink href={newsHref} onClick={() => onOpenChange(false)} />
            }
          >
            News
          </Button>
          <Button
            type="button"
            variant="outline"
            className={drawerFormFullWidthButtonClassName}
            render={
              <AppNavLink href={hoursHref} onClick={() => onOpenChange(false)} />
            }
          >
            Öffnungszeiten bearbeiten
          </Button>
          {day && !day.hoursException?.closed ? (
            <Button
              type="button"
              variant="outline"
              className={drawerFormFullWidthButtonClassName}
              disabled={savingClosed || !restaurantId}
              onClick={() => void markClosed()}
            >
              {savingClosed ? "Speichern …" : "Tag geschlossen markieren"}
            </Button>
          ) : null}
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
