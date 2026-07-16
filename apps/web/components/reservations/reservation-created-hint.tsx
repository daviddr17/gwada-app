"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { reservationCreatorDisplayName } from "@/lib/reservations/format-reservation-creator";
import { fetchReservationLogEntries } from "@/lib/supabase/reservation-log-db";
import type { ReservationCreatorProfileJoin } from "@/lib/supabase/reservations-db";
import { formatReservationLogActorLabel } from "@/lib/types/reservation-log";
import { cn } from "@/lib/utils";

export function ReservationCreatedHint({
  restaurantId,
  reservationId,
  createdAt,
  createdByProfileId,
  createdByProfile,
  className,
}: {
  restaurantId?: string | null;
  reservationId?: string | null;
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

  const profileWho = createdByProfileId
    ? reservationCreatorDisplayName(createdByProfileId, createdByProfile)
    : null;

  const [logWho, setLogWho] = useState<string | null>(null);

  useEffect(() => {
    if (createdByProfileId || !restaurantId || !reservationId) {
      setLogWho(null);
      return;
    }
    let cancelled = false;
    void fetchReservationLogEntries(restaurantId, reservationId).then((result) => {
      if (cancelled) return;
      const created = result.data.find((entry) => entry.action === "created");
      if (!created) {
        setLogWho("Gast");
        return;
      }
      setLogWho(formatReservationLogActorLabel(created.details, "Gast"));
    });
    return () => {
      cancelled = true;
    };
  }, [createdByProfileId, restaurantId, reservationId]);

  const whoLabel = profileWho ?? logWho ?? "Gast";

  return (
    <p className={cn("text-xs leading-snug text-muted-foreground/90", className)}>
      Erstellt am {whenLabel}
      {" · "}
      von{" "}
      <span className="font-medium text-foreground">{whoLabel}</span>
    </p>
  );
}
