"use client";

import { Users } from "lucide-react";
import {
  reservationDayNoteChipBadgeClassName,
  reservationDayNoteChipClassName,
} from "@/lib/ui/reservation-day-note-chip";

type ReservationDayShiftStaffOverviewChipProps = {
  count: number;
  onClick: () => void;
};

/** Kompakter Icon-Button — gleiche Größe wie Tagesnotiz. */
export function ReservationDayShiftStaffOverviewChip({
  count,
  onClick,
}: ReservationDayShiftStaffOverviewChipProps) {
  const label =
    count === 1 ? "1 Mitarbeiter geplant" : `${count} Mitarbeiter geplant`;

  return (
    <button
      type="button"
      className={reservationDayNoteChipClassName}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${label} — Übersicht öffnen`}
      title={label}
    >
      <Users className="size-4" aria-hidden />
      {count > 0 ? (
        <span className={reservationDayNoteChipBadgeClassName} aria-hidden>
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}
