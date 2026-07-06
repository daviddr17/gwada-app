"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { fetchReservationLogEntries } from "@/lib/supabase/reservation-log-db";
import {
  formatReservationLogActorLabel,
  formatReservationLogDetailsSummary,
  reservationLogActionLabel,
  type RestaurantReservationLogEntry,
} from "@/lib/types/reservation-log";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ReservationProtocolSection({
  restaurantId,
  reservationId,
  refreshKey,
}: {
  restaurantId: string;
  reservationId: string;
  /** Erhöhen nach Speichern, damit das Protokoll neu lädt. */
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<RestaurantReservationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchReservationLogEntries(restaurantId, reservationId);
    setLoading(false);
    if (result.error) {
      setEntries([]);
      return;
    }
    setEntries(result.data);
  }, [restaurantId, reservationId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  if (loading && !showSkeleton) {
    return <div className="min-h-16" aria-busy="true" />;
  }

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Einträge — Änderungen erscheinen nach dem Speichern.
      </p>
    );
  }

  return (
    <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-muted/15 p-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="border-b border-border/30 pb-2 text-sm last:border-0 last:pb-0"
        >
          <p className="font-medium">
            {reservationLogActionLabel(entry.action)}
            {" · "}
            <span className="font-normal text-muted-foreground">
              {whenFmt.format(new Date(entry.created_at))}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatReservationLogActorLabel(entry.details)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/90">
            {formatReservationLogDetailsSummary(entry.details, entry.action)}
          </p>
        </li>
      ))}
    </ul>
  );
}
