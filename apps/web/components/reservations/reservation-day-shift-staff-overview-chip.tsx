"use client";

import { Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { reservationDayNoteChipClassName } from "@/lib/ui/reservation-day-note-chip";

type ReservationDayShiftStaffOverviewChipProps = {
  count: number;
  onClick: () => void;
};

export function ReservationDayShiftStaffOverviewChip({
  count,
  onClick,
}: ReservationDayShiftStaffOverviewChipProps) {
  const label =
    count === 1 ? "1 Mitarbeiter geplant" : `${count} Mitarbeiter geplant`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={reservationDayNoteChipClassName}
            onClick={onClick}
            aria-label={`${label} — Übersicht öffnen`}
          >
            <Users className="size-3 shrink-0" aria-hidden />
            <span>{label}</span>
          </button>
        }
      />
      <TooltipContent side="top">
        Geplant laut Schichtplan — tippen für Übersicht
      </TooltipContent>
    </Tooltip>
  );
}
