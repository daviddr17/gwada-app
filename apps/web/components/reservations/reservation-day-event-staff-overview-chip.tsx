"use client";

import { PartyPopper } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PRIVATE_EVENT_STRIPE_HEX } from "@/lib/reservations/reservation-kind";
import { cn } from "@/lib/utils";

type ReservationDayEventStaffOverviewChipProps = {
  count: number;
  onClick: () => void;
};

/** Chip für Veranstaltungs-Mitarbeiter — Farbe wie Veranstaltungs-Streifen. */
export function ReservationDayEventStaffOverviewChip({
  count,
  onClick,
}: ReservationDayEventStaffOverviewChipProps) {
  const label =
    count === 1
      ? "1 für Veranstaltung"
      : `${count} für Veranstaltung`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium leading-none",
              "transition-colors",
            )}
            style={{
              borderColor: `${PRIVATE_EVENT_STRIPE_HEX}59`,
              backgroundColor: `${PRIVATE_EVENT_STRIPE_HEX}1a`,
              color: PRIVATE_EVENT_STRIPE_HEX,
            }}
            onClick={onClick}
            aria-label={`${label} — Übersicht öffnen`}
          >
            <PartyPopper className="size-3 shrink-0" aria-hidden />
            <span>{label}</span>
          </button>
        }
      />
      <TooltipContent side="top">
        Mitarbeiter auf Veranstaltungen — tippen für Übersicht
      </TooltipContent>
    </Tooltip>
  );
}
