"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterSwitchRow,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type ReservationStatusFilterOption = {
  id: string;
  name: string;
};

type ReservationsFilterDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusOptions: ReservationStatusFilterOption[];
  statusFilterId: string;
  onStatusFilterIdChange: (id: string) => void;
  /** Nur im aktuellen Kalendermonat sichtbar */
  showHidePastSection: boolean;
  hidePastReservations: boolean;
  onHidePastReservationsChange: (v: boolean) => void;
  hideEmptyDays: boolean;
  onHideEmptyDaysChange: (v: boolean) => void;
  unconfirmedMode: boolean;
  onUnconfirmedModeChange: (enabled: boolean) => void;
};

export function ReservationsFilterDrawer({
  open,
  onOpenChange,
  statusOptions,
  statusFilterId,
  onStatusFilterIdChange,
  showHidePastSection,
  hidePastReservations,
  onHidePastReservationsChange,
  hideEmptyDays,
  onHideEmptyDaysChange,
  unconfirmedMode,
  onUnconfirmedModeChange,
}: ReservationsFilterDrawerProps) {
  const statusItems = useMemo(() => {
    const m: Record<string, string> = { all: "Alle Status" };
    for (const o of statusOptions) {
      m[o.id] = o.name;
    }
    return m;
  }, [statusOptions]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={drawerContentClassName("template")}
      >
        <DrawerFilterHeader title="Filter" />

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            {!unconfirmedMode ? (
              <DrawerFilterField label="Status">
                <Select
                  value={statusFilterId}
                  items={statusItems}
                  onValueChange={(v) => {
                    if (typeof v === "string") onStatusFilterIdChange(v);
                  }}
                >
                  <SelectTrigger
                    id="res-filter-status"
                    className="h-12 w-full rounded-2xl text-left text-base font-medium"
                  >
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {statusOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DrawerFilterField>
            ) : null}

            <DrawerFilterSwitchRow>
              <Label htmlFor="res-filter-unconfirmed" className="text-sm font-medium">
                Alle unbestätigten
              </Label>
              <Switch
                id="res-filter-unconfirmed"
                checked={unconfirmedMode}
                onCheckedChange={(v) =>
                  onUnconfirmedModeChange(v === true)
                }
                size="sm"
              />
            </DrawerFilterSwitchRow>

            <DrawerFilterSwitchRow>
              <Label htmlFor="res-filter-empty-days" className="text-sm font-medium">
                Tage ohne Reservierungen ausblenden
              </Label>
              <Switch
                id="res-filter-empty-days"
                checked={hideEmptyDays}
                onCheckedChange={(v) => onHideEmptyDaysChange(v === true)}
                size="sm"
              />
            </DrawerFilterSwitchRow>

            {showHidePastSection ? (
              <DrawerFilterSwitchRow>
                <Label htmlFor="res-filter-hide-past" className="text-sm font-medium">
                  Vergangene Tage ausblenden
                </Label>
                <Switch
                  id="res-filter-hide-past"
                  checked={hidePastReservations}
                  onCheckedChange={(v) =>
                    onHidePastReservationsChange(v === true)
                  }
                  size="sm"
                />
              </DrawerFilterSwitchRow>
            ) : null}
          </DrawerFilterZone>
        </div>

        <DrawerFilterFooter
          onReset={() => {
            onUnconfirmedModeChange(false);
            onStatusFilterIdChange("all");
            onHidePastReservationsChange(true);
            onHideEmptyDaysChange(false);
          }}
          onDone={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
