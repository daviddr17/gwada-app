"use client";

import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";
import {
  dayReservationExportTotals,
  downloadDayReservationsCsv,
  downloadDayReservationsPdf,
  printDayReservations,
} from "@/lib/reservations/export-day-reservations";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

export function DayReservationsExportSheet({
  open,
  onOpenChange,
  day,
  dayTitle,
  reservations,
  restaurantName,
  timeZone,
  dayYmd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  dayTitle: string;
  reservations: ReservationListRow[];
  restaurantName?: string;
  timeZone?: string;
  dayYmd?: string;
}) {
  const { reservationCount, guestCount } = dayReservationExportTotals(reservations);

  const handlePrint = () => {
    if (reservationCount === 0) return;
    try {
      printDayReservations(reservations, {
        restaurantName,
        dayTitle,
        timeZone,
        dayYmd,
      });
      onOpenChange(false);
    } catch {
      toast.error("Drucken fehlgeschlagen.");
    }
  };

  const handleCsv = () => {
    if (!day || reservationCount === 0) return;
    try {
      downloadDayReservationsCsv(day, reservations, {
        restaurantName,
        dayTitle,
        timeZone,
        dayYmd,
      });
      toast.success("CSV wurde heruntergeladen.");
      onOpenChange(false);
    } catch {
      toast.error("CSV-Export fehlgeschlagen.");
    }
  };

  const handlePdf = () => {
    if (!day || reservationCount === 0) return;
    void (async () => {
      try {
        await downloadDayReservationsPdf(day, reservations, {
          restaurantName,
          dayTitle,
          timeZone,
          dayYmd,
        });
        toast.success("PDF wurde heruntergeladen.");
        onOpenChange(false);
      } catch {
        toast.error("PDF-Export fehlgeschlagen.");
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
            Tagesliste exportieren
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {dayTitle}
            {reservationCount > 0
              ? ` · ${reservationCount} Reservierung${reservationCount === 1 ? "" : "en"} · ${guestCount} Person${guestCount === 1 ? "" : "en"}`
              : ""}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <Button
            type="button"
            className={cn("h-12 justify-start gap-3", brandActionButtonRoundedClassName)}
            disabled={reservationCount === 0}
            onClick={handlePrint}
          >
            <Printer className="size-5 shrink-0" />
            <span className="text-left">
              <span className="block font-medium">Jetzt drucken</span>
              <span className="block text-xs font-normal opacity-90">
                DIN A4 Querformat mit Spalte „Kommentare“ für Notizen
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 rounded-xl px-4"
            disabled={reservationCount === 0}
            onClick={handleCsv}
          >
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Als CSV</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Für Excel, Numbers oder weitere Auswertung
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 rounded-xl px-4"
            disabled={reservationCount === 0}
            onClick={handlePdf}
          >
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Als PDF</span>
              <span className="block text-xs font-normal text-muted-foreground">
                DIN A4 Querformat zum Archivieren oder Weiterleiten
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
