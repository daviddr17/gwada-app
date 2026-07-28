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

type DisplayAvailabilitySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  staffId: string;
  disabled?: boolean;
};

export function DisplayAvailabilitySheet({
  open,
  onOpenChange,
  restaurantId,
  staffId,
  disabled = false,
}: DisplayAvailabilitySheetProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
      handleOnly
    >
      <DrawerContent
        className={drawerContentClassName("formMd")}
        aria-disabled={disabled || undefined}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold">Verfügbarkeit</DrawerTitle>
          <DrawerDescription>
            Für konkrete Tage oder ausgewählte Wochen — sichtbar im Schichtplan.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[min(78dvh,42rem)] overflow-x-hidden overflow-y-auto px-4 pb-6">
          <StaffAvailabilityEditor
            restaurantId={restaurantId}
            staffId={staffId}
            compact
            displayApi
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
