"use client";

import { cn } from "@/lib/utils";

export function DisplayPeriodStatsBar({
  reservationCount,
  guestCount,
  freeTables,
  occupiedTables,
  freeSeats,
  occupiedSeats,
  totalSeats,
  className,
}: {
  reservationCount: number;
  guestCount: number;
  freeTables: number;
  occupiedTables: number;
  freeSeats: number;
  occupiedSeats: number;
  totalSeats: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl border border-border/50 bg-muted/15 p-3 text-sm sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      <p>
        Reservierungen:{" "}
        <span className="font-semibold tabular-nums">{reservationCount}</span>
      </p>
      <p>
        Gäste: <span className="font-semibold tabular-nums">{guestCount}</span>
      </p>
      <p>
        Freie Tische:{" "}
        <span className="font-semibold tabular-nums">{freeTables}</span>
      </p>
      <p>
        Besetzt:{" "}
        <span className="font-semibold tabular-nums">{occupiedTables}</span>
      </p>
      <p>
        Freie Plätze:{" "}
        <span className="font-semibold tabular-nums">{freeSeats}</span>
      </p>
      <p>
        Belegte Plätze:{" "}
        <span className="font-semibold tabular-nums">
          {occupiedSeats}
          <span className="font-normal text-muted-foreground">
            {" "}
            / {totalSeats}
          </span>
        </span>
      </p>
    </div>
  );
}
