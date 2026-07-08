"use client";

import { Printer, RotateCcw } from "lucide-react";
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
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { notifyPrintResult } from "@/lib/export/notify-print-result";
import {
  buildDayReservationExportRows,
  DAY_RESERVATION_EXPORT_HEADERS,
  dayReservationExportTotals,
  printDayReservations,
} from "@/lib/reservations/export-day-reservations";
import { sortReservationsByStart } from "@/lib/reservations/sort-reservations-by-start";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormBodyClassName,
  drawerFormHeaderClassName,
  drawerHorizontalPaddingClassName,
} from "@/lib/ui/drawer-form-section";
import {
  moduleDataTableHeadRowClassName,
  moduleDataTableShellClassName,
} from "@/lib/ui/module-data-table";
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

  const previewRows = useMemo(
    () => buildDayReservationExportRows(filteredReservations, { timeZone }),
    [filteredReservations, timeZone],
  );

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
      <DrawerContent className={drawerContentClassName("displayForm")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Tagesliste drucken
          </DrawerTitle>
          <DrawerDescription className="text-base">{description}</DrawerDescription>
        </DrawerHeader>

        <div className={cn(drawerFormBodyClassName, "pb-4")}>
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-end gap-3 pb-3",
              drawerHorizontalPaddingClassName(6),
            )}
          >
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <SearchableSelect
                options={statusOptions}
                value={statusFilter}
                onValueChange={setStatusFilter}
                placeholder="Alle Status"
                searchPlaceholder="Status suchen…"
                aria-label="Status filtern"
                className={filterSelectClassName}
              />
            </div>
            {activeFilterCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 shrink-0 gap-1.5 rounded-xl"
                onClick={() => {
                  setStatusFilter(ALL);
                  toast.success("Filter zurückgesetzt");
                }}
              >
                <RotateCcw className="size-4" />
                Zurücksetzen
              </Button>
            ) : null}
          </div>

          <div
            className={cn(
              drawerHorizontalPaddingClassName(6),
              "flex min-h-0 min-w-0 flex-1 flex-col",
            )}
          >
            <p className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">
              Vorschau (DIN A4 Querformat)
            </p>
            <div
              className={cn(
                moduleDataTableShellClassName,
                "min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-y",
              )}
            >
              <div className="space-y-1 border-b border-border/50 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground">Reservierungen</p>
                <p className="text-foreground">{dayTitle}</p>
                {restaurantName?.trim() ? (
                  <p className="text-muted-foreground">{restaurantName.trim()}</p>
                ) : null}
                {reservationCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {reservationCount} Reservierung
                    {reservationCount === 1 ? "" : "en"} · {guestCount} Person
                    {guestCount === 1 ? "" : "en"} gesamt
                  </p>
                ) : null}
              </div>

              {previewRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {activeFilterCount > 0
                    ? "Keine Einträge für den gewählten Filter."
                    : "Keine Reservierungen für diesen Tag."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] border-collapse text-sm">
                    <thead>
                      <tr className={moduleDataTableHeadRowClassName}>
                        {DAY_RESERVATION_EXPORT_HEADERS.map((header) => (
                          <th
                            key={header}
                            className={cn(
                              "px-2 py-2.5 font-medium whitespace-nowrap",
                              header === "Kommentare" && "min-w-[8rem]",
                              header === "Zeit" && "min-w-[6.5rem]",
                            )}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={cn(
                            "border-b border-border/40",
                            rowIndex % 2 === 1 && "bg-muted/30",
                          )}
                        >
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={cn(
                                "px-2 py-2 align-middle text-foreground",
                                cellIndex === 3 && "text-center tabular-nums",
                                cellIndex === 8 && "text-center tabular-nums",
                                cellIndex === 9 &&
                                  "min-h-[2.75rem] min-w-[8rem] text-muted-foreground/40",
                              )}
                            >
                              {cellIndex === 9 ? (
                                <span aria-hidden className="block min-h-[1.5rem]" />
                              ) : (
                                cell || "—"
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "shrink-0 space-y-2 pt-3",
              drawerHorizontalPaddingClassName(6),
            )}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={cn(
                  "h-12 min-w-0 flex-1 gap-2",
                  brandActionButtonRoundedClassName,
                )}
                disabled={filteredReservations.length === 0}
                onClick={handlePrint}
              >
                <Printer className="size-4" />
                Jetzt drucken
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 rounded-xl px-5"
                onClick={() => onOpenChange(false)}
              >
                Schließen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Auf dem iPad: Teilen → Drucken (Querformat). Am Mac/PC öffnet sich
              der System-Druckdialog mit DIN A4 Querformat und Spalte
              „Kommentare“.
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
