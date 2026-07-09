"use client";

import { StickyNote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { reservationDayNoteChipClassName } from "@/lib/ui/reservation-day-note-chip";

type ReservationDayNoteOverviewChipProps = {
  count: number;
  onClick: () => void;
};

export function ReservationDayNoteOverviewChip({
  count,
  onClick,
}: ReservationDayNoteOverviewChipProps) {
  const label = count === 1 ? "1 Tagesnotiz" : `${count} Tagesnotizen`;
  const tooltip =
    count === 1 ? "Tagesnotiz anzeigen" : "Tagesnotizen anzeigen";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={reservationDayNoteChipClassName}
            onClick={onClick}
            aria-label={`${label} — ${tooltip}`}
          >
            <StickyNote className="size-3 shrink-0" aria-hidden />
            <span>{label}</span>
          </button>
        }
      />
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
