"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { reservationBookingTermsSections } from "@/lib/legal/reservation-booking-terms-de";

export function EmbedReservationTermsSheet({
  open,
  onOpenChange,
  restaurantName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantName: string;
}) {
  const sections = reservationBookingTermsSections(restaurantName);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="mx-auto flex max-h-[min(88dvh,640px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Bedingungen zur Reservierung
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {restaurantName.trim() || "Restaurant"} · Datenschutz und
            Reservierungsbedingungen
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          <div className="space-y-5 text-sm leading-relaxed text-foreground/90">
            {sections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-2 font-semibold text-foreground">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 48)}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-border/50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
