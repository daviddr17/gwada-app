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
        <div className={drawerScrollAreaClassName(6)}>
          <StaffAvailabilityEditor
            restaurantId={restaurantId}
            staffId={staffId}
            compact
            displayApi
          />
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
