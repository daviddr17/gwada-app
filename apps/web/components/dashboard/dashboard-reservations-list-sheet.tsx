"use client";

import {
  DashboardCompactList,
  DashboardCompactListItem,
} from "@/components/dashboard/dashboard-compact-list";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import {
  formatReservationSlotInRestaurantTz,
  formatReservationTimeInRestaurantTz,
} from "@/lib/restaurant/restaurant-timezone";
import type { DashboardReservationRecent } from "@/lib/reservations/compute-dashboard-reservation-summary";

export type DashboardReservationsListSheetMode = "today_upcoming" | "unconfirmed";

const SHEET_COPY: Record<
  DashboardReservationsListSheetMode,
  { title: string; empty: string; trailing: "time" | "slot" }
> = {
  today_upcoming: {
    title: "Reservierungen heute",
    empty: "Keine anstehenden Reservierungen für heute.",
    trailing: "time",
  },
  unconfirmed: {
    title: "Unbestätigte Reservierungen",
    empty: "Keine unbestätigten Reservierungen.",
    trailing: "slot",
  },
};

export function DashboardReservationsListSheet({
  open,
  onOpenChange,
  mode,
  rows,
  timeZone,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DashboardReservationsListSheetMode;
  rows: DashboardReservationRecent[];
  timeZone: string;
  description?: string;
}) {
  const copy = SHEET_COPY[mode];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {copy.title}
          </DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {copy.empty}
            </p>
          ) : (
            <DashboardCompactList aria-label={copy.title}>
              {rows.map((row) => (
                <DashboardCompactListItem
                  key={row.id}
                  href={row.href}
                  title={row.guestLabel}
                  meta={`${row.partySize} Pers. · ${row.statusName}`}
                  trailing={
                    copy.trailing === "time"
                      ? formatReservationTimeInRestaurantTz(
                          row.startsAt,
                          timeZone,
                        )
                      : formatReservationSlotInRestaurantTz(
                          row.startsAt,
                          timeZone,
                        )
                  }
                  stripeVariant={row.unconfirmed ? "attention" : undefined}
                  className="py-2.5"
                />
              ))}
            </DashboardCompactList>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
