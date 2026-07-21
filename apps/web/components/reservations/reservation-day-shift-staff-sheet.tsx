"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { positionGroupHeaderStyle } from "@/lib/staff/shift-plan-position-groups";
import {
  fetchReservationDayShiftStaffOverview,
  type ReservationDayShiftStaffGroup,
} from "@/lib/staff/reservation-day-shift-staff-overview";
import { cn } from "@/lib/utils";

type ReservationDayShiftStaffSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  dayKey: string | null;
  dayLabel: string | null;
  timeZone: string;
};

export function ReservationDayShiftStaffSheet({
  open,
  onOpenChange,
  restaurantId,
  dayKey,
  dayLabel,
  timeZone,
}: ReservationDayShiftStaffSheetProps) {
  const [groups, setGroups] = useState<ReservationDayShiftStaffGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!open || !restaurantId || !dayKey) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await fetchReservationDayShiftStaffOverview(
        restaurantId,
        dayKey,
        timeZone,
      );
      if (cancelled) return;
      if (error) {
        toast.error("Schichtplan konnte nicht geladen werden.");
        setGroups([]);
      } else {
        setGroups(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId, dayKey, timeZone]);

  const scheduleHref = dayKey
    ? `${APP_ROUTES.mitarbeiter.schedule}?day=${encodeURIComponent(dayKey)}`
    : APP_ROUTES.mitarbeiter.schedule;

  const staffCount = new Set(
    groups.flatMap((g) => g.entries.map((e) => e.staffId)),
  ).size;

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
            Geplante Mitarbeiter
          </DrawerTitle>
          {dayLabel ? (
            <DrawerDescription className="text-base">
              {staffCount > 0
                ? `${dayLabel} · ${staffCount} Person${staffCount === 1 ? "" : "en"}`
                : dayLabel}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection>
            {loading && !showSkeleton ? (
              <div className="min-h-24" aria-busy="true" />
            ) : null}
            {showSkeleton ? (
              <div className="space-y-3" aria-busy>
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Keine Schichten für diesen Tag geplant.
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <section key={group.positionId ?? "none"} className="space-y-1.5">
                    <div
                      className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                      style={positionGroupHeaderStyle(group.positionColor)}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: group.positionColor }}
                        aria-hidden
                      />
                      <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                        {group.positionName}
                      </h3>
                      <span className="ml-auto tabular-nums text-[11px] text-muted-foreground">
                        {group.entries.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card">
                      {group.entries.map((entry) => (
                        <li
                          key={entry.shiftId}
                          className="flex items-baseline justify-between gap-3 px-2.5 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {entry.name}
                            </p>
                            {entry.status === "pending" ? (
                              <p className="text-[11px] text-muted-foreground">
                                Ausstehend
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {entry.timeLabel}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </DrawerFormSection>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/50 px-6 pb-6 pt-4">
          <Button
            type="button"
            size="lg"
            className={cn("w-full", brandActionButtonRoundedClassName)}
            render={
              <Link
                href={scheduleHref}
                onClick={() => onOpenChange(false)}
              />
            }
          >
            Zur Planung
          </Button>
          <Button
            type="button"
            variant="outline"
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
