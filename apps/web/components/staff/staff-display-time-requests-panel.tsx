"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import type { DisplayTimeRequestEntryType } from "@/lib/staff/staff-display-time-request-types";
import {
  formatRestaurantDateTime,
  formatReservationTimeInRestaurantTz,
} from "@/lib/restaurant/restaurant-timezone";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { STAFF_WORK_ENTRY_LABELS, type StaffWorkEntryType } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

type TimeRequestRow = {
  id: string;
  staff_id: string;
  entry_type: DisplayTimeRequestEntryType;
  requested_starts_at: string;
  requested_ends_at: string;
  created_at: string;
  staff: {
    given_name: string;
    family_name: string;
    avatar_url: string | null;
  };
};

export function StaffDisplayTimeRequestsPanel({
  restaurantId,
  className,
}: {
  restaurantId: string;
  className?: string;
}) {
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const [rows, setRows] = useState<TimeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/staff/display-time-requests?restaurant_id=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = (await res.json()) as { requests?: TimeRequestRow[] };
      setRows(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onRefresh = () => void reload();
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onRefresh);
  }, [reload]);

  const review = async (requestId: string, decision: "approve" | "decline") => {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/staff/display-time-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, decision }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "not_pending"
            ? "Anfrage wurde bereits bearbeitet."
            : "Aktion fehlgeschlagen.",
        );
        return;
      }
      toast.success(
        decision === "approve" ? "Nachtragung freigegeben." : "Anfrage abgelehnt.",
      );
      window.dispatchEvent(new Event(GWADA_STAFF_DATA_REFRESH_EVENT));
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Card className={cn("border-border/50 shadow-card", className)}>
        <CardContent className="min-h-20 py-4" aria-busy="true" />
      </Card>
    );
  }

  if (rows.length === 0) return null;

  return (
    <Card className={cn("border-accent/25 bg-accent/5 shadow-card", className)}>
      <CardContent className="space-y-3 py-4">
        <div>
          <p className="text-sm font-medium">Offene Nachtragungs-Anfragen</p>
          <p className="text-xs text-muted-foreground">
            Vom Display — Zeitraum prüfen und freigeben.
          </p>
        </div>
        <ul className="space-y-3">
          {rows.map((row) => {
            const name =
              `${row.staff.given_name} ${row.staff.family_name}`.trim();
            const busy = busyId === row.id;
            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <DisplayRoundAvatar
                    src={row.staff.avatar_url}
                    initials={displayPersonInitials(
                      row.staff.given_name,
                      row.staff.family_name,
                    )}
                    alt={name}
                    size="lg"
                    className="size-11 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StaffWorkEntryTypeStripe
                        type={row.entry_type as StaffWorkEntryType}
                        className="h-4"
                      />
                      <p className="text-sm font-medium">
                        {STAFF_WORK_ENTRY_LABELS[row.entry_type]}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatRestaurantDateTime(
                        row.requested_starts_at,
                        restaurantTimeZone,
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        },
                      )}{" "}
                      ·{" "}
                      {formatReservationTimeInRestaurantTz(
                        row.requested_starts_at,
                        restaurantTimeZone,
                      )}
                      –
                      {formatReservationTimeInRestaurantTz(
                        row.requested_ends_at,
                        restaurantTimeZone,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="flex-1 rounded-xl sm:flex-none"
                    onClick={() => void review(row.id, "decline")}
                  >
                    <X className="size-4" />
                    Ablehnen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    className={cn(
                      "flex-1 rounded-xl sm:flex-none",
                      brandActionButtonRoundedClassName,
                    )}
                    onClick={() => void review(row.id, "approve")}
                  >
                    <Check className="size-4" />
                    Freigeben
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
