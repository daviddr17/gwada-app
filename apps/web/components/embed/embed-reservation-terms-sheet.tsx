"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { reservationBookingTermsSections } from "@/lib/legal/reservation-booking-terms-de";

/** Über Profil-App-Sheet (z-[60]) und Dock (z-[9999]). */
const profileElevatedDrawerClassName = "z-[10001]";

export function EmbedReservationTermsSheet({
  open,
  onOpenChange,
  restaurantName,
  elevated = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantName: string;
  /** Nested drawer inside profile app sheet — above sheet chrome. */
  elevated?: boolean;
}) {
  const sections = reservationBookingTermsSections(restaurantName);
  const elevatedClassName = elevated ? profileElevatedDrawerClassName : undefined;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        overlayClassName={elevatedClassName}
        className={cn(
          "mx-auto flex max-h-[min(88dvh,640px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated",
          elevatedClassName,
        )}
      >
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
