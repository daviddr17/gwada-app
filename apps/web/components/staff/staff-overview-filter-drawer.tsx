"use client";

import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export type StaffOverviewStatusFilter = "active" | "inactive" | "all";

const STATUS_LABELS: Record<StaffOverviewStatusFilter, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  all: "Alle",
};

type StaffOverviewFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusFilter: StaffOverviewStatusFilter;
  onStatusFilterChange: (value: StaffOverviewStatusFilter) => void;
};

export function countStaffOverviewActiveFilters(input: {
  statusFilter: StaffOverviewStatusFilter;
}): number {
  return input.statusFilter === "active" ? 0 : 1;
}

export function StaffOverviewFilterDrawer({
  open,
  onOpenChange,
  statusFilter,
  onStatusFilterChange,
}: StaffOverviewFilterDrawerProps) {
  const resetFilters = () => {
    onStatusFilterChange("active");
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">Filter</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Standardmäßig werden nur aktive Mitarbeiter angezeigt.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFormSection title="Status">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value === "active" || value === "inactive" || value === "all") {
                onStatusFilterChange(value);
              }
            }}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
              aria-label="Mitarbeiter-Status filtern"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as StaffOverviewStatusFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DrawerFormSection>

        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
