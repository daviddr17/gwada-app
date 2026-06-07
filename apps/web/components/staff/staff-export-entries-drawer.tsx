"use client";

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
      <DrawerContent className="mx-auto flex max-h-[min(88dvh,640px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          <StaffExportEntriesByDay days={days} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
