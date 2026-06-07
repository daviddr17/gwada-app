"use client";

import { reservationStatusStripeHex } from "@/lib/reservations/reservation-status-ui";
import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";
import { cn } from "@/lib/utils";

export function ReservationStatusLabel({
  status,
  className,
  compact,
}: {
  status: Pick<ReservationStatusJoin, "name" | "color_hex">;
  className?: string;
  compact?: boolean;
}) {
  const hex = reservationStatusStripeHex(status);
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          compact ? "h-3 w-1" : "h-4 w-1",
        )}
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <span
        className={cn(
          "truncate font-medium",
          compact ? "text-sm" : "text-sm sm:text-base",
        )}
        style={{ color: hex }}
      >
        {status.name}
      </span>
    </span>
  );
}
