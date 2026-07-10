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
            Trage ein, wann du grundsätzlich oder an bestimmten Tagen verfügbar
            bist — sichtbar für die Schichtplanung.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[min(78dvh,42rem)] overflow-y-auto px-4 pb-6">
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
