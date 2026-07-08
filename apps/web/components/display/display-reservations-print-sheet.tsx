"use client";

import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  DrawerFormBody,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { notifyPrintResult } from "@/lib/export/notify-print-result";
import {
  dayReservationExportTotals,
  printDayReservations,
} from "@/lib/reservations/export-day-reservations";
import { sortReservationsByStart } from "@/lib/reservations/sort-reservations-by-start";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";

const ALL = "all";

const filterSelectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

type ReservationStatusOption = {
  id: string;
  name: string;
};

type DisplayReservationsPrintSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayTitle: string;
  reservations: ReservationListRow[];
  statuses: ReservationStatusOption[];
  restaurantName?: string;
  timeZone?: string;
  dayYmd?: string;
};

export function DisplayReservationsPrintSheet({
  open,
  onOpenChange,
  dayTitle,
  reservations,
  statuses,
  restaurantName,
  timeZone,
  dayYmd,
}: DisplayReservationsPrintSheetProps) {
  const [statusFilter, setStatusFilter] = useState(ALL);

  useEffect(() => {
    if (!open) return;
    setStatusFilter(ALL);
  }, [open]);

  const statusOptions = useMemo(
    () => [
      { value: ALL, label: "Alle Status" },
      ...statuses.map((s) => ({ value: s.id, label: s.name })),
    ],
    [statuses],
  );

  const filteredReservations = useMemo(() => {
    const rows =
      statusFilter === ALL
        ? reservations
        : reservations.filter(
            (r) => r.reservation_statuses?.id === statusFilter,
          );
    return sortReservationsByStart(rows);
  }, [reservations, statusFilter]);

  const { reservationCount, guestCount } = dayReservationExportTotals(
    filteredReservations,
  );
  const activeFilterCount = statusFilter === ALL ? 0 : 1;

  const description =
    reservationCount > 0
      ? `${dayTitle} · ${reservationCount} Reservierung${reservationCount === 1 ? "" : "en"} · ${guestCount} Person${guestCount === 1 ? "" : "en"}${
          activeFilterCount > 0 ? " · 1 Filter aktiv" : ""
        }`
      : activeFilterCount > 0
        ? "Keine Reservierungen für die gewählten Filter."
        : "Noch keine Reservierungen zum Drucken.";

  const handlePrint = () => {
    if (filteredReservations.length === 0) return;
    void (async () => {
      try {
        const result = await printDayReservations(filteredReservations, {
          restaurantName,
          dayTitle,
          timeZone,
          dayYmd,
        });
        notifyPrintResult(result);
        onOpenChange(false);
      } catch {
        toast.error("Drucken fehlgeschlagen.");
      }
    })();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("export")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Tagesliste drucken
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Filter">
              <SearchableSelect
                options={statusOptions}
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder="Alle Status"
                searchPlaceholder="Status suchen…"
                aria-label="Status filtern"
                className={filterSelectClassName}
              />
            </DrawerFormSection>

            <DrawerFormSection title="Drucken">
              <Button
                type="button"
                className={cn(
                  "h-12 w-full gap-2",
                  brandActionButtonRoundedClassName,
                )}
                disabled={filteredReservations.length === 0}
                onClick={handlePrint}
              >
                <Printer className="size-4" />
                Jetzt drucken
              </Button>
              <p className="text-xs text-muted-foreground">
                Auf dem iPad: Teilen → Drucken (Querformat). Am Mac/PC öffnet sich
                der System-Druckdialog mit DIN A4 Querformat und Spalte „Kommentare“.
              </p>
            </DrawerFormSection>
          </div>

          <DrawerFilterFooter
            onReset={() => {
              setStatusFilter(ALL);
              toast.success("Filter zurückgesetzt");
            }}
            onDone={() => onOpenChange(false)}
            doneLabel="Schließen"
          />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
