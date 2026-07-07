"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  approveReservationChangeRequest,
  declineReservationChangeRequest,
  getReservationPendingChange,
} from "@/lib/supabase/reservation-change-request-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";
import {
  dispatchReservationOpenResolvedLivePatch,
  nextStatusCodeAfterChangeRequestApprove,
  nextStatusCodeAfterChangeRequestDecline,
} from "@/lib/reservations/reservation-open-status";
import {
  formatReservationSlotDe,
  reservationChangeDiffKeys,
} from "@/lib/reservations/reservation-pending-change";
import { cn } from "@/lib/utils";

function DiffRow({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 line-through text-muted-foreground">{before}</p>
      <p className="mt-0.5 font-medium text-foreground">{after}</p>
    </div>
  );
}

export function ReservationChangeRequestPanel({
  reservation,
  restaurantId,
  statuses = [],
  onResolved,
  className,
}: {
  reservation: ReservationListRow;
  restaurantId: string;
  statuses?: ReservationStatusJoin[];
  onResolved: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const pending = getReservationPendingChange(reservation);

  if (reservation.reservation_statuses?.code !== "change_requested" || !pending) {
    return null;
  }

  const guestBefore =
    `${reservation.guest_first_name} ${reservation.guest_last_name}`.trim();
  const guestAfter =
    `${pending.guest_first_name} ${pending.guest_last_name}`.trim();
  const diffKeys = reservationChangeDiffKeys(reservation, pending);

  const handleApprove = async () => {
    setBusy("approve");
    const { error } = await approveReservationChangeRequest({
      restaurantId,
      reservationId: reservation.id,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    dispatchReservationOpenResolvedLivePatch({
      restaurantId,
      reservationId: reservation.id,
      previousStatusCode: "change_requested",
      nextStatusCode: nextStatusCodeAfterChangeRequestApprove(statuses, reservation),
    });
    toast.success("Änderung übernommen.");
    onResolved();
  };

  const handleDecline = async () => {
    setBusy("decline");
    const { error } = await declineReservationChangeRequest({
      restaurantId,
      reservationId: reservation.id,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    dispatchReservationOpenResolvedLivePatch({
      restaurantId,
      reservationId: reservation.id,
      previousStatusCode: "change_requested",
      nextStatusCode: nextStatusCodeAfterChangeRequestDecline(statuses, reservation),
    });
    toast.success("Änderungsanfrage abgelehnt.");
    onResolved();
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/8 p-4",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">
          Änderungsanfrage vom Gast
        </p>
        <p className="text-xs text-muted-foreground">
          Vergleich: aktuell gespeichert → gewünscht
        </p>
      </div>

      <div className="space-y-2">
        {diffKeys.includes("guest") ? (
          <DiffRow label="Gast" before={guestBefore} after={guestAfter} />
        ) : null}
        {diffKeys.includes("party_size") ? (
          <DiffRow
            label="Personen"
            before={String(reservation.party_size)}
            after={String(pending.party_size)}
          />
        ) : null}
        {diffKeys.includes("starts_at") ? (
          <DiffRow
            label="Termin"
            before={formatReservationSlotDe(reservation.starts_at)}
            after={formatReservationSlotDe(pending.starts_at)}
          />
        ) : null}
        {diffKeys.includes("guest_phone") ? (
          <DiffRow
            label="Telefon"
            before={reservation.guest_phone ?? "—"}
            after={pending.guest_phone ?? "—"}
          />
        ) : null}
        {diffKeys.includes("guest_email") ? (
          <DiffRow
            label="E-Mail"
            before={reservation.guest_email ?? "—"}
            after={pending.guest_email ?? "—"}
          />
        ) : null}
        {diffKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine erkennbaren Feldänderungen (bitte prüfen).
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
          disabled={busy !== null}
          onClick={() => void handleApprove()}
        >
          {busy === "approve" ? "Übernehmen…" : "Änderung übernehmen"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={busy !== null}
          onClick={() => void handleDecline()}
        >
          {busy === "decline" ? "Ablehnen…" : "Ablehnen"}
        </Button>
      </div>
    </div>
  );
}
