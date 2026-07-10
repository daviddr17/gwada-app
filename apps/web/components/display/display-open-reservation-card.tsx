"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import { formatReservationSlotDe } from "@/lib/reservations/reservation-pending-change";
import { cn } from "@/lib/utils";

type DisplayOpenReservationCardProps = {
  reservation: DisplayReservationRow;
  busy: boolean;
  changeHint?: string | null;
  onConfirm?: () => void;
  onReject?: () => void;
  onApproveChange?: () => void;
  onDeclineChange?: () => void;
  onOpen?: () => void;
};

export function DisplayOpenReservationCard({
  reservation: r,
  busy,
  changeHint,
  onConfirm,
  onReject,
  onApproveChange,
  onDeclineChange,
  onOpen,
}: DisplayOpenReservationCardProps) {
  const timeZone = useDisplayRestaurantTimezone();
  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );
  const guestName = `${r.guest_first_name} ${r.guest_last_name}`.trim();
  const code = r.status?.code;
  const isChangeRequest = code === "change_requested";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-card",
        isChangeRequest
          ? "border-amber-500/35 bg-amber-500/5"
          : "border-border/50",
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                #{r.reservation_number}
              </span>
              {r.status ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ backgroundColor: r.status.color_hex }}
                >
                  {r.status.name}
                </span>
              ) : null}
            </div>
            <p className="text-lg font-semibold leading-snug">{guestName}</p>
            <p className="text-sm text-muted-foreground">
              {formatReservationSlotDe(r.starts_at, timeZone)} –{" "}
              {timeFmt.format(new Date(r.ends_at))} · {r.party_size} Pers.
            </p>
            {isChangeRequest && changeHint ? (
              <p className="text-sm text-foreground/90">{changeHint}</p>
            ) : null}
          </div>
        </div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        {isChangeRequest ? (
          <>
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-12 min-w-[8rem] rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90",
              )}
              disabled={busy}
              onClick={onApproveChange}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Übernehmen"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 min-w-[8rem] rounded-xl"
              disabled={busy}
              onClick={onDeclineChange}
            >
              Ablehnen
            </Button>
          </>
        ) : onConfirm || onReject ? (
          <>
            {onConfirm ? (
              <Button
                type="button"
                size="lg"
                className={cn(
                  "h-12 min-w-[8rem] rounded-xl",
                  brandActionButtonRoundedClassName,
                )}
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Bestätigen"
                )}
              </Button>
            ) : null}
            {onReject ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-12 min-w-[8rem] rounded-xl"
                disabled={busy}
                onClick={onReject}
              >
                Ablehnen
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
