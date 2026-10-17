"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import type { StaffProfileChangeDiffItem } from "@/lib/staff/staff-profile-change-request-types";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProfileChangeRequestRow = {
  id: string;
  staff_id: string;
  created_at: string;
  diff: StaffProfileChangeDiffItem[];
  staff: {
    given_name: string;
    family_name: string;
    avatar_url: string | null;
  };
};

export function StaffProfileChangeRequestsPanel({
  restaurantId,
  className,
}: {
  restaurantId: string;
  className?: string;
}) {
  const [rows, setRows] = useState<ProfileChangeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/staff/profile-change-requests?restaurant_id=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = (await res.json()) as {
        requests?: ProfileChangeRequestRow[];
      };
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

  const review = async (
    requestId: string,
    decision: "approve" | "decline",
  ) => {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/staff/profile-change-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          decision,
          review_note:
            decision === "decline"
              ? declineNotes[requestId]?.trim() || null
              : null,
        }),
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
        decision === "approve"
          ? "Profil übernommen."
          : "Profiländerung abgelehnt.",
      );
      window.dispatchEvent(new Event(GWADA_STAFF_DATA_REFRESH_EVENT));
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  if (loading || rows.length === 0) return null;

  return (
    <Card className={cn("border-accent/25 bg-accent/5 shadow-card", className)}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Offene Profil-Änderungen</p>
            <p className="text-xs text-muted-foreground">
              Vom Display — Diff prüfen und übernehmen oder ablehnen.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {rows.length}
          </Badge>
        </div>
        <ul className="space-y-3">
          {rows.map((row) => {
            const name =
              `${row.staff.given_name} ${row.staff.family_name}`.trim();
            const busy = busyId === row.id;
            return (
              <li
                key={row.id}
                className="rounded-xl border border-border/50 bg-card p-3"
              >
                <div className="flex items-center gap-3">
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
                    <p className="text-xs text-muted-foreground">
                      {row.diff.length} Feld
                      {row.diff.length === 1 ? "" : "er"} geändert
                    </p>
                  </div>
                </div>

                {row.diff.length > 0 ? (
                  <dl className="mt-3 space-y-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm">
                    {row.diff.map((item) => (
                      <div
                        key={item.key}
                        className="grid gap-0.5 sm:grid-cols-[7rem_1fr]"
                      >
                        <dt className="text-muted-foreground">{item.label}</dt>
                        <dd className="min-w-0">
                          <span className="text-muted-foreground line-through decoration-muted-foreground/60">
                            {item.fromLabel}
                          </span>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="font-medium text-foreground">
                            {item.toLabel}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <div className="mt-3 space-y-2">
                  <Input
                    value={declineNotes[row.id] ?? ""}
                    onChange={(e) =>
                      setDeclineNotes((prev) => ({
                        ...prev,
                        [row.id]: e.target.value,
                      }))
                    }
                    placeholder="Ablehnungsgrund (optional)"
                    disabled={busy}
                    className="h-9 rounded-xl"
                  />
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
                      Übernehmen
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
