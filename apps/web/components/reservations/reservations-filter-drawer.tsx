"use client";

import { useMemo } from "react";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
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
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {unconfirmedMode
              ? "Anzeige der unbestätigten Reservierungen (alle Monate)."
              : "Reservierungen in der Monatsübersicht nach Status und Anzeige filtern."}
          </DrawerDescription>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          {!unconfirmedMode ? (
            <DrawerFormSection title="Status">
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
            </DrawerFormSection>
          ) : null}

          <DrawerFormSection title="Unbestätigt">
            <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span
                id="res-filter-unconfirmed"
                className="min-w-0 text-sm font-medium leading-snug"
              >
                Alle unbestätigten
              </span>
              <Switch
                checked={unconfirmedMode}
                onCheckedChange={(v) =>
                  onUnconfirmedModeChange(v === true)
                }
                size="sm"
                aria-labelledby="res-filter-unconfirmed"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Status Offen oder Änderung prüfen — über alle Monate, wie vom
              Dashboard.
            </p>
            </div>
          </DrawerFormSection>

          <DrawerFormSection title="Kalender">
            <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span
                id="res-filter-empty-days"
                className="min-w-0 text-sm font-medium leading-snug"
              >
                Tage ohne Reservierungen ausblenden
              </span>
              <Switch
                checked={hideEmptyDays}
                onCheckedChange={(v) => onHideEmptyDaysChange(v === true)}
                size="sm"
                aria-labelledby="res-filter-empty-days"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Blendet Kalendertage aus, an denen nach den aktuellen Filtern keine
              Reservierung angezeigt wird.
            </p>
            </div>

          {showHidePastSection ? (
            <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <span
                    id="res-filter-hide-past"
                    className="min-w-0 text-sm font-medium leading-snug"
                  >
                    Vergangene Tage ausblenden
                  </span>
                  <Switch
                    checked={hidePastReservations}
                    onCheckedChange={(v) =>
                      onHidePastReservationsChange(v === true)
                    }
                    size="sm"
                    aria-labelledby="res-filter-hide-past"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  Wenn aktiv, erscheinen im aktuellen Monat nur noch Tage ab heute.
                  Wenn aus, wird der komplette Monat ab dem 1. Tag geladen und
                  angezeigt.
                </p>
              </div>
          ) : null}
          </DrawerFormSection>
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
