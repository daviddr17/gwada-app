"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchReservationDayNoteEntries } from "@/lib/supabase/reservation-day-notes-db";
import type { RestaurantReservationDayNoteEntry } from "@/lib/types/reservation-day-notes";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

type ReservationDayNotesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  serviceDate: string | null;
  dayLabel: string | null;
};

export function ReservationDayNotesSheet({
  open,
  onOpenChange,
  restaurantId,
  serviceDate,
  dayLabel,
}: ReservationDayNotesSheetProps) {
  const [entries, setEntries] = useState<RestaurantReservationDayNoteEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const reloadEntries = useCallback(async () => {
    if (!restaurantId || !serviceDate) return;
    setLoading(true);
    const { data, error } = await fetchReservationDayNoteEntries(
      restaurantId,
      serviceDate,
    );
    if (error) {
      toast.error("Tagesnotizen konnten nicht geladen werden.");
      setEntries([]);
    } else {
      setEntries(data);
    }
    setLoading(false);
  }, [restaurantId, serviceDate]);

  useEffect(() => {
    if (!open) return;
    void reloadEntries();
  }, [open, reloadEntries]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("info")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Tagesnotizen
          </DrawerTitle>
          {dayLabel ? (
            <DrawerDescription className="text-base">
              {dayLabel}
            </DrawerDescription>
          ) : null}
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFormSection>
            {loading && !showSkeleton ? (
              <div className="min-h-24" aria-busy="true" />
            ) : null}
            {showSkeleton ? (
              <div className="space-y-2" aria-busy>
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Keine Tagesnotizen für diesen Tag.
              </p>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry) => {
                  const edited =
                    entry.updated_at &&
                    entry.updated_at !== entry.created_at;
                  return (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm"
                    >
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(entry.created_at)}
                        {edited ? " · bearbeitet" : null}
                        {entry.actor_label ? ` · ${entry.actor_label}` : null}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                        {entry.body}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </DrawerFormSection>
        </div>

        <div className="shrink-0 border-t border-border/50 px-6 pb-6 pt-4">
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
