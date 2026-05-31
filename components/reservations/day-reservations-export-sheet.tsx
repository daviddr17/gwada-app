"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  dayReservationExportTotals,
  downloadDayReservationsCsv,
  downloadDayReservationsPdf,
} from "@/lib/reservations/export-day-reservations";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

export function DayReservationsExportSheet({
  open,
  onOpenChange,
  day,
  dayTitle,
  reservations,
  restaurantName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  dayTitle: string;
  reservations: ReservationListRow[];
  restaurantName?: string;
}) {
  const { reservationCount, guestCount } = dayReservationExportTotals(reservations);

  const handleCsv = () => {
    if (!day || reservationCount === 0) return;
    try {
      downloadDayReservationsCsv(day, reservations);
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
      <DrawerContent className="mx-auto flex max-h-[min(88dvh,420px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
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
                Zum Ausdrucken mit extra Spalte „Kommentare“ für Notizen
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
