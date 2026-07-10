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
};

export function ReservationDayShiftStaffOverviewChip({
  count,
}: ReservationDayShiftStaffOverviewChipProps) {
  const label =
    count === 1 ? "1 Mitarbeiter geplant" : `${count} Mitarbeiter geplant`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={reservationDayNoteChipClassName}
            aria-label={label}
          >
            <Users className="size-3 shrink-0" aria-hidden />
            <span>{label}</span>
          </span>
        }
      />
      <TooltipContent side="top">Geplant laut Schichtplan</TooltipContent>
    </Tooltip>
  );
}
