"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StaffAvailabilityEditor } from "@/components/staff/staff-availability-editor";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";

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
        <div className="max-h-[min(78dvh,42rem)] overflow-x-hidden overflow-y-auto px-4 pb-6">
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
      </DrawerContent>
    </Drawer>
  );
}
