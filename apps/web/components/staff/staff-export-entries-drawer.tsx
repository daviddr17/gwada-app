"use client";

import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StaffExportEntriesByDay } from "@/components/staff/staff-export-entries-list";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

type StaffExportEntriesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  days: {
    dayKey: string;
    heading: string;
    entries: RestaurantStaffWorkEntryRow[];
  }[];
};

export function StaffExportEntriesDrawer({
  open,
  onOpenChange,
  title,
  description,
  days,
}: StaffExportEntriesDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("formMd")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection>
            <StaffExportEntriesByDay days={days} />
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
