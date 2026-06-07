"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ReservationStatusLabel } from "@/components/reservations/reservation-status-label";
import type { ContactReservationLink } from "@/lib/supabase/contacts-db";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactReservationsDrawer({
  open,
  onOpenChange,
  contactName,
  reservations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  reservations: ContactReservationLink[];
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto flex max-h-[min(88dvh,520px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Verknüpfte Reservierungen
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Reservierungen von „{contactName}“ im System.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 pb-4">
          {reservations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Reservierungen mit diesem Kontakt verknüpft.
            </p>
          ) : (
            <ul className="space-y-2">
              {reservations.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium tabular-nums">
                        #{r.reservation_number} · {r.party_size} Pers.
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {formatWhen(r.starts_at)}
                    </p>
                    {r.reservation_statuses ? (
                      <div className="pl-6">
                        <ReservationStatusLabel
                          status={r.reservation_statuses}
                          compact
                        />
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full"
                    render={
                      <Link
                        href={`/reservierungen/uebersicht?reservation=${r.id}`}
                        prefetch
                      />
                    }
                    onClick={() => onOpenChange(false)}
                  >
                    Öffnen
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border/50 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
