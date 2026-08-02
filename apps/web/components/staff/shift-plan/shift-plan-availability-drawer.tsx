"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StaffAvailabilityEditor } from "@/components/staff/staff-availability-editor";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { appMobileBottomSafePbMdClassName } from "@/lib/ui/app-mobile-bottom-nav";
import { cn } from "@/lib/utils";

type ShiftPlanAvailabilityDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  staffName: string;
  /** Vorausgewählter Tag (YYYY-MM-DD). */
  initialDayYmd?: string | null;
  onSlotsChanged?: () => void;
};

export function ShiftPlanAvailabilityDrawer({
  open,
  onOpenChange,
  restaurantId,
  staffId,
  staffName,
  initialDayYmd,
  onSlotsChanged,
}: ShiftPlanAvailabilityDrawerProps) {
  const initialDates =
    initialDayYmd && /^\d{4}-\d{2}-\d{2}$/.test(initialDayYmd)
      ? [initialDayYmd]
      : undefined;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
      handleOnly
    >
      <DrawerContent className={drawerContentClassName("formMd")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold">
            Verfügbarkeit · {staffName}
          </DrawerTitle>
          <DrawerDescription>
            Ohne Schicht vormerken — z.&nbsp;B. wenn der Mitarbeiter Bescheid
            gegeben hat. Sichtbar im Schichtplan.
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {open ? (
            <StaffAvailabilityEditor
              key={`${staffId}:${initialDayYmd ?? ""}`}
              restaurantId={restaurantId}
              staffId={staffId}
              staffLabel={staffName}
              compact
              initialServiceDates={initialDates}
              onSlotsChanged={onSlotsChanged}
            />
          ) : null}
        </div>
        <div
          className={cn(
            "shrink-0 border-t border-border/50 px-6 py-3",
            appMobileBottomSafePbMdClassName,
          )}
        >
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
