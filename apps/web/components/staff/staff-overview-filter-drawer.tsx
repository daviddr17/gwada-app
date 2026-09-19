"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { findStaffContractForDay } from "@/lib/staff/staff-day-wage";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  StaffEmploymentTypeDefinition,
  StaffPositionTagDefinition,
} from "@/lib/types/staff";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const selectClass = appSelectTriggerAccentCn(staffDrawerFieldClassName);

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
  /** Zurücksetzen. Übersicht: nur Aktive. Arbeitszeiten: alle Status. */
  resetTo?: StaffOverviewFilterState;
};

export function countStaffOverviewActiveFilters(
  input: StaffOverviewFilterState,
  baseline: StaffOverviewFilterState = STAFF_OVERVIEW_FILTER_DEFAULTS,
): number {
  let n = 0;
  if (input.statusFilter !== baseline.statusFilter) n += 1;
  if (input.positionFilter !== baseline.positionFilter) n += 1;
  if (input.appFilter !== baseline.appFilter) n += 1;
  if (input.presenceFilter !== baseline.presenceFilter) n += 1;
  if (input.roleFilter !== baseline.roleFilter) n += 1;
  if (input.employmentFilter !== baseline.employmentFilter) n += 1;
  return n;
}

/** Dieselbe Auswahl wie in der Mitarbeiter-Übersicht, ohne die Textsuche. */
export function applyStaffOverviewFilters(
  rows: RestaurantStaffRow[],
  filters: StaffOverviewFilterState,
  workingIds: Set<string>,
  breakIds: Set<string>,
  contracts: RestaurantStaffContractRow[],
  dayDate: string,
  search = "",
): RestaurantStaffRow[] {
  let list = [...rows];

  if (filters.statusFilter === "active") {
    list = list.filter((r) => r.is_active);
  } else if (filters.statusFilter === "inactive") {
    list = list.filter((r) => !r.is_active);
  }

  if (filters.positionFilter === "__none__") {
    list = list.filter((r) => !r.position_tag_id);
  } else if (filters.positionFilter !== "all") {
    list = list.filter((r) => r.position_tag_id === filters.positionFilter);
  }

  if (filters.appFilter === "linked") {
    list = list.filter((r) => Boolean(r.profile_id));
  } else if (filters.appFilter === "unlinked") {
    list = list.filter((r) => !r.profile_id);
  }

  if (filters.presenceFilter === "working") {
    list = list.filter((r) => workingIds.has(r.id));
  } else if (filters.presenceFilter === "on_break") {
    list = list.filter((r) => breakIds.has(r.id));
  } else if (filters.presenceFilter === "off") {
    list = list.filter((r) => !workingIds.has(r.id) && !breakIds.has(r.id));
  }

  if (filters.roleFilter === "__none__") {
    list = list.filter((r) => !r.restaurant_position_id);
  } else if (filters.roleFilter !== "all") {
    list = list.filter((r) => r.restaurant_position_id === filters.roleFilter);
  }

  if (filters.employmentFilter !== "all") {
    list = list.filter((r) => {
      const contract = findStaffContractForDay(contracts, r.id, dayDate);
      if (filters.employmentFilter === "__none__") {
        return !contract?.employment_type_id;
      }
      return contract?.employment_type_id === filters.employmentFilter;
    });
  }

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((r) => {
      const hay = [
        r.family_name,
        r.given_name,
        r.email ?? "",
        r.phone ?? "",
        r.position_tag?.name ?? "",
        r.restaurant_position?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return list;
}

export function StaffOverviewFilterDrawer({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  positionTags,
  roleOptions,
  employmentTypes,
  resetTo = STAFF_OVERVIEW_FILTER_DEFAULTS,
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
    onFiltersChange(resetTo);
    toast.success("Filter zurückgesetzt");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("filter")}>
        <DrawerFilterHeader title="Filter" />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            <DrawerFilterField label="Status">
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
            </DrawerFilterField>

            <DrawerFilterField label="Position">
              <SearchableSelect
                value={filters.positionFilter}
                onValueChange={(value) => onFiltersChange({ positionFilter: value })}
                options={positionOptions}
                placeholder="Alle Positionen"
                searchPlaceholder="Position suchen…"
                className={selectClass}
                aria-label="Position filtern"
              />
            </DrawerFilterField>

            <DrawerFilterField label="Zugang">
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
            </DrawerFilterField>

            <DrawerFilterField label="Anwesenheit">
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
            </DrawerFilterField>

            {roleOptions.length > 1 ? (
              <DrawerFilterField label="Rolle">
                <SearchableSelect
                  value={filters.roleFilter}
                  onValueChange={(value) => onFiltersChange({ roleFilter: value })}
                  options={roleOptions}
                  placeholder="Alle Rollen"
                  searchPlaceholder="Rolle suchen…"
                  className={selectClass}
                  aria-label="Rolle filtern"
                />
              </DrawerFilterField>
            ) : null}

            {employmentTypes.length > 0 ? (
              <DrawerFilterField label="Beschäftigung">
                <SearchableSelect
                  value={filters.employmentFilter}
                  onValueChange={(value) => onFiltersChange({ employmentFilter: value })}
                  options={employmentOptions}
                  placeholder="Alle Beschäftigungsarten"
                  searchPlaceholder="Beschäftigungsart suchen…"
                  className={selectClass}
                  aria-label="Beschäftigungsart filtern"
                />
              </DrawerFilterField>
            ) : null}
          </DrawerFilterZone>
        </div>

        <DrawerFilterFooter onReset={resetFilters} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}
