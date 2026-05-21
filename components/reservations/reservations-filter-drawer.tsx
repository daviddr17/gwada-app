"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
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
        className="mx-auto flex max-h-[min(92dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Filter
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Reservierungen in der Monatsübersicht nach Status und Anzeige filtern.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-2">
          <div className="space-y-3">
            <Label
              htmlFor="res-filter-status"
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Status
            </Label>
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
          </div>

          <Separator />

          <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
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
            <>
              <Separator />
              <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
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
            </>
          ) : null}
        </div>

        <Separator />

        <div className="flex gap-3 px-6 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={() => {
              onStatusFilterIdChange("all");
              onHidePastReservationsChange(true);
              onHideEmptyDaysChange(false);
            }}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 tap-scale"
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
