"use client";

import { StickyNote } from "lucide-react";
import {
  reservationDayNoteChipBadgeClassName,
  reservationDayNoteChipClassName,
} from "@/lib/ui/reservation-day-note-chip";

type ReservationDayNoteOverviewChipProps = {
  count: number;
  onClick: () => void;
};

/** Icon-Button (44×44) — kein Tooltip, damit Mobil den ersten Tap trifft. */
export function ReservationDayNoteOverviewChip({
  count,
  onClick,
}: ReservationDayNoteOverviewChipProps) {
  const label = count === 1 ? "1 Tagesnotiz" : `${count} Tagesnotizen`;

  return (
    <button
      type="button"
      className={reservationDayNoteChipClassName}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${label} anzeigen`}
      title={label}
    >
      <StickyNote className="size-5" aria-hidden />
      {count > 0 ? (
        <span className={reservationDayNoteChipBadgeClassName} aria-hidden>
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}
