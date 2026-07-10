"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { reservationDayNoteChipClassName } from "@/lib/ui/reservation-day-note-chip";

type ReservationDayShiftStaffOverviewChipProps = {
  count: number;
  /** YYYY-MM-DD — springt zum Schichtplan (Tagesansicht). */
  dayKey?: string;
};

export function ReservationDayShiftStaffOverviewChip({
  count,
  dayKey,
}: ReservationDayShiftStaffOverviewChipProps) {
  const label =
    count === 1 ? "1 Mitarbeiter geplant" : `${count} Mitarbeiter geplant`;

  const href = dayKey
    ? `${APP_ROUTES.mitarbeiter.schedule}?day=${encodeURIComponent(dayKey)}`
    : APP_ROUTES.mitarbeiter.schedule;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            className={reservationDayNoteChipClassName}
            aria-label={`${label} — Schichtplan öffnen`}
          >
            <Users className="size-3 shrink-0" aria-hidden />
            <span>{label}</span>
          </Link>
        }
      />
      <TooltipContent side="top">
        Geplant laut Schichtplan — tippen für Tagesansicht
      </TooltipContent>
    </Tooltip>
  );
}
