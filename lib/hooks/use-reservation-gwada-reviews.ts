"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReservationGwadaReviewSummary } from "@/lib/reviews/reservation-gwada-review-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function useReservationGwadaReviews(
  restaurantId: string | null,
  reservationIds: readonly string[],
): Map<string, ReservationGwadaReviewSummary> {
  const idsKey = useMemo(
    () => [...new Set(reservationIds.filter(Boolean))].sort().join(","),
    [reservationIds],
  );
  const [map, setMap] = useState<Map<string, ReservationGwadaReviewSummary>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!restaurantId || !idsKey) {
      setMap(new Map());
      return;
    }
    const ids = idsKey.split(",").filter(Boolean);
    let cancelled = false;

    void (async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gwada_reviews")
        .select(
          "id, reservation_id, rating, comment, guest_display_name, created_at",
        )
        .eq("restaurant_id", restaurantId)
        .in("reservation_id", ids);

      if (cancelled) return;

      const next = new Map<string, ReservationGwadaReviewSummary>();
      if (!error) {
        for (const row of data ?? []) {
          const reservationId = row.reservation_id as string | null;
          if (!reservationId) continue;
          next.set(reservationId, {
            id: row.id as string,
            reservationId,
            rating: Number(row.rating),
            comment: (row.comment as string | null) ?? null,
            guestDisplayName: (row.guest_display_name as string | null) ?? null,
            createdAt: row.created_at as string,
          });
        }
      }
      setMap(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, idsKey]);

  return map;
}
