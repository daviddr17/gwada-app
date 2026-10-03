"use client";

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
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { ReservationDayNotesSection } from "@/components/reservations/reservation-day-notes-section";

type ReservationDayNotesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  serviceDate: string | null;
  dayLabel: string | null;
  onNotesChanged?: () => void;
};

export function ReservationDayNotesSheet({
  open,
  onOpenChange,
  restaurantId,
  serviceDate,
  dayLabel,
  onNotesChanged,
}: ReservationDayNotesSheetProps) {
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
            Tagesnotizen
          </DrawerTitle>
          {dayLabel ? (
            <DrawerDescription className="text-base">
              {dayLabel}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection>
            <ReservationDayNotesSection
              open={open}
              restaurantId={restaurantId}
              serviceDate={serviceDate}
              onNotesChanged={onNotesChanged}
              className="border-b-0 pb-0"
            />
          </DrawerFormSection>
        </div>

        <div className="shrink-0 border-t border-border/50 px-6 pb-6 pt-4">
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
