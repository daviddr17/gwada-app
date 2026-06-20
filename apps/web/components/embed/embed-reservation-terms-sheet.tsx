"use client";

import { Button } from "@/components/ui/button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerScrollAreaClassName, drawerFormHeaderClassName, drawerFormFullWidthButtonClassName } from "@/lib/ui/drawer-form-section";
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
          drawerContentClassName("formMd"),
          elevatedClassName,
        )}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Bedingungen zur Reservierung
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            {restaurantName.trim() || "Restaurant"} · Datenschutz und
            Reservierungsbedingungen
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
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
            className={drawerFormFullWidthButtonClassName}
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
