"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmPendingReservationFromBrowser } from "@/lib/reservations/confirm-reservation-client";
import {
  dispatchReservationOpenResolvedLivePatch,
} from "@/lib/reservations/reservation-open-status";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { cn } from "@/lib/utils";

/** Schnell-Bestätigen für pending-Reservierungen (Dashboard + Übersichtsliste). */
export function ReservationQuickAcceptButton({
  restaurantId,
  reservationId,
  statusCode,
  className,
  onConfirmed,
  onFailed,
}: {
  restaurantId: string;
  reservationId: string;
  statusCode: string;
  className?: string;
  /** Sofort nach optimistischem Patch (Listen/Dashboard). */
  onConfirmed?: () => void;
  /** Bei API-Fehler — Cache zurücksetzen. */
  onFailed?: () => void;
}) {
  const { isSuperadmin } = useIsSuperadmin();
  const [optimisticConfirmed, setOptimisticConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (statusCode !== "pending" && !optimisticConfirmed) return null;

  if (optimisticConfirmed) {
    return (
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          className,
        )}
        aria-label="Reservierung bestätigt"
        title="Bestätigt"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={busy || !restaurantId}
      className={cn(
        "size-9 shrink-0 rounded-full border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300",
        className,
      )}
      aria-label="Reservierung bestätigen"
      title="Schnell bestätigen"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy || !restaurantId) return;

        setOptimisticConfirmed(true);
        setBusy(true);
        dispatchReservationOpenResolvedLivePatch({
          restaurantId,
          reservationId,
          previousStatusCode: statusCode,
          nextStatusCode: "confirmed",
        });
        onConfirmed?.();

        void (async () => {
          try {
            const result = await confirmPendingReservationFromBrowser({
              restaurantId,
              reservationId,
              isSuperadmin,
            });
            if (!result.ok) {
              setOptimisticConfirmed(false);
              onFailed?.();
              toast.error(result.error);
              return;
            }
            toast.success("Reservierung bestätigt.");
          } catch {
            setOptimisticConfirmed(false);
            onFailed?.();
            toast.error("Bestätigen fehlgeschlagen.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <Check className="size-4" />
    </Button>
  );
}
