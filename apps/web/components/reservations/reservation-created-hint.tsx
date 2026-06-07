"use client";

import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { reservationCreatorDisplayName } from "@/lib/reservations/format-reservation-creator";
import type { ReservationCreatorProfileJoin } from "@/lib/supabase/reservations-db";
import { cn } from "@/lib/utils";

export function ReservationCreatedHint({
  createdAt,
  createdByProfileId,
  createdByProfile,
  className,
}: {
  createdAt: string;
  createdByProfileId: string | null;
  createdByProfile: ReservationCreatorProfileJoin | null;
  className?: string;
}) {
  let whenLabel = "—";
  try {
    const d = parseISO(createdAt);
    if (!Number.isNaN(d.getTime())) {
      whenLabel = format(d, "d. MMM yyyy, HH:mm", { locale: de });
    }
  } catch {
    /* keep fallback */
  }

  const whoLabel = reservationCreatorDisplayName(
    createdByProfileId,
    createdByProfile,
  );

  return (
    <p className={cn("text-xs leading-snug text-muted-foreground/90", className)}>
      Erstellt am {whenLabel}
      {" · "}
      von{" "}
      <span className="font-medium text-foreground">{whoLabel}</span>
    </p>
  );
}
