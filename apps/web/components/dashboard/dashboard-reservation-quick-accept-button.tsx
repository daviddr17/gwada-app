"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmPendingReservationFromBrowser } from "@/lib/reservations/confirm-reservation-client";
import { useIsSuperadmin } from "@/lib/hooks/use-is-superadmin";
import { cn } from "@/lib/utils";

/** Schnell-Bestätigen für pending-Reservierungen in Dashboard-Listen. */
export function DashboardReservationQuickAcceptButton({
  restaurantId,
  reservationId,
  statusCode,
  className,
}: {
  restaurantId: string;
  reservationId: string;
  statusCode: string;
  className?: string;
}) {
  const { isSuperadmin } = useIsSuperadmin();
  const [busy, setBusy] = useState(false);

  if (statusCode !== "pending") return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={busy || !restaurantId}
      className={cn(
        "rounded-full border-emerald-500/45 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300",
        className,
      )}
      aria-label="Reservierung bestätigen"
      title="Schnell bestätigen"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy || !restaurantId) return;
        void (async () => {
          setBusy(true);
          try {
            const result = await confirmPendingReservationFromBrowser({
              restaurantId,
              reservationId,
              isSuperadmin,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Reservierung bestätigt.");
            if (result.warning) toast.warning(result.warning);
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
