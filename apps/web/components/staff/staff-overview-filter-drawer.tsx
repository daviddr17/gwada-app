"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import type {
  StaffEmploymentTypeDefinition,
  StaffPositionTagDefinition,
} from "@/lib/types/staff";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

const fieldHintClassName = "text-xs text-muted-foreground";

const POSITION_HINT =
  "Nur für Planung und Statistik (z. B. Schichtplan, Auswertungen).";

const ROLE_HINT =
  "Steuert die tatsächlichen Berechtigungen in der App (Dashboard, Display, Module).";

export type StaffOverviewStatusFilter = "active" | "inactive" | "all";
export type StaffOverviewAppFilter = "all" | "linked" | "unlinked";
export type StaffOverviewPresenceFilter = "all" | "working" | "on_break" | "off";

export type StaffOverviewFilterState = {
  statusFilter: StaffOverviewStatusFilter;
  positionFilter: string;
  appFilter: StaffOverviewAppFilter;
  presenceFilter: StaffOverviewPresenceFilter;
  roleFilter: string;
  employmentFilter: string;
};

export const STAFF_OVERVIEW_FILTER_DEFAULTS: StaffOverviewFilterState = {
  statusFilter: "active",
  positionFilter: "all",
  appFilter: "all",
  presenceFilter: "all",
  roleFilter: "all",
  employmentFilter: "all",
};

const STATUS_OPTIONS: { value: StaffOverviewStatusFilter; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "inactive", label: "Inaktiv" },
  { value: "all", label: "Alle" },
];

const APP_OPTIONS: { value: StaffOverviewAppFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "linked", label: "Mit Dashboard-Zugang" },
  { value: "unlinked", label: "Ohne Dashboard-Zugang" },
];

const PRESENCE_OPTIONS: { value: StaffOverviewPresenceFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "working", label: "Gerade aktiv (Display)" },
  { value: "on_break", label: "In Pause (Display)" },
  { value: "off", label: "Nicht eingestempelt" },
];

type StaffOverviewFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: StaffOverviewFilterState;
  onFiltersChange: (patch: Partial<StaffOverviewFilterState>) => void;
  positionTags: StaffPositionTagDefinition[];
  roleOptions: { value: string; label: string }[];
  employmentTypes: StaffEmploymentTypeDefinition[];
};

export function countStaffOverviewActiveFilters(
  input: StaffOverviewFilterState,
): number {
  let n = 0;
  if (input.statusFilter !== "active") n += 1;
  if (input.positionFilter !== "all") n += 1;
  if (input.appFilter !== "all") n += 1;
  if (input.presenceFilter !== "all") n += 1;
  if (input.roleFilter !== "all") n += 1;
  if (input.employmentFilter !== "all") n += 1;
  return n;
}

export function StaffOverviewFilterDrawer({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  positionTags,
  roleOptions,
  employmentTypes,
}: StaffOverviewFilterDrawerProps) {
  const positionOptions = useMemo(
    () => [
      { value: "all", label: "Alle Positionen" },
      ...positionTags.map((t) => ({
        value: t.id,
        label: t.name,
        leadingColor: t.backgroundColor,
      })),
      { value: "__none__", label: "Ohne Position" },
    ],
    [positionTags],
  );

  const employmentOptions = useMemo(
    () => [
      { value: "all", label: "Alle Beschäftigungsarten" },
      ...employmentTypes.map((t) => ({ value: t.id, label: t.name })),
      { value: "__none__", label: "Ohne aktiven Vertrag" },
    ],
    [employmentTypes],
  );

  const resetFilters = () => {
    onFiltersChange(STAFF_OVERVIEW_FILTER_DEFAULTS);
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle>Filter</DrawerTitle>
          <DrawerDescription>
            Status, Position, App-Verknüpfung, Anwesenheit, Rolle und Beschäftigungsart.
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection title="Status">
            <SearchableSelect
              value={filters.statusFilter}
              onValueChange={(value) => {
                if (value === "active" || value === "inactive" || value === "all") {
                  onFiltersChange({ statusFilter: value });
                }
              }}
              options={STATUS_OPTIONS}
              className={selectClass}
              aria-label="Mitarbeiter-Status filtern"
            />
          </DrawerFormSection>

          <DrawerFormSection title="Position">
            <div className="space-y-2">
              <p className={fieldHintClassName}>{POSITION_HINT}</p>
              <SearchableSelect
                value={filters.positionFilter}
                onValueChange={(value) => onFiltersChange({ positionFilter: value })}
                options={positionOptions}
                placeholder="Alle Positionen"
                searchPlaceholder="Position suchen…"
                className={selectClass}
                aria-label="Position filtern"
              />
            </div>
          </DrawerFormSection>

          <DrawerFormSection title="Dashboard-Zugang">
            <SearchableSelect
              value={filters.appFilter}
              onValueChange={(value) => {
                if (value === "all" || value === "linked" || value === "unlinked") {
                  onFiltersChange({ appFilter: value });
                }
              }}
              options={APP_OPTIONS}
              className={selectClass}
              aria-label="App-Verknüpfung filtern"
            />
          </DrawerFormSection>

          <DrawerFormSection title="Anwesenheit heute">
            <SearchableSelect
              value={filters.presenceFilter}
              onValueChange={(value) => {
                if (
                  value === "all" ||
                  value === "working" ||
                  value === "on_break" ||
                  value === "off"
                ) {
                  onFiltersChange({ presenceFilter: value });
                }
              }}
              options={PRESENCE_OPTIONS}
              className={selectClass}
              aria-label="Anwesenheit filtern"
            />
          </DrawerFormSection>

          {roleOptions.length > 1 ? (
            <DrawerFormSection title="Rolle">
              <div className="space-y-2">
                <p className={fieldHintClassName}>{ROLE_HINT}</p>
                <SearchableSelect
                  value={filters.roleFilter}
                  onValueChange={(value) => onFiltersChange({ roleFilter: value })}
                  options={roleOptions}
                  placeholder="Alle Rollen"
                  searchPlaceholder="Rolle suchen…"
                  className={selectClass}
                  aria-label="Rolle filtern"
                />
              </div>
            </DrawerFormSection>
          ) : null}

          {employmentTypes.length > 0 ? (
            <DrawerFormSection title="Beschäftigungsart">
              <SearchableSelect
                value={filters.employmentFilter}
                onValueChange={(value) => onFiltersChange({ employmentFilter: value })}
                options={employmentOptions}
                placeholder="Alle Beschäftigungsarten"
                searchPlaceholder="Beschäftigungsart suchen…"
                className={selectClass}
                aria-label="Beschäftigungsart filtern"
              />
            </DrawerFormSection>
          ) : null}
        </div>

        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
