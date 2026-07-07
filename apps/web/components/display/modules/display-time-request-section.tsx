"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type PendingRequest = {
  id: string;
  requested_starts_at: string;
  created_at: string;
};

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

function defaultLocalTimeValue(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function DisplayTimeRequestSection({
  disabled,
  onChanged,
}: {
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(
    null,
  );
  const [timeValue, setTimeValue] = useState(defaultLocalTimeValue);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/display/time/request", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        pending_request?: PendingRequest | null;
      };
      setPendingRequest(data.pending_request ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitRequest = async () => {
    if (busy || disabled || pendingRequest) return;
    setBusy(true);
    try {
      const res = await fetch("/api/display/time/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ time: timeValue }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "time_in_future"
            ? "Die Zeit liegt in der Zukunft."
            : data.error === "invalid_time"
              ? "Bitte eine gültige Uhrzeit eingeben."
              : data.error === "already_clocked_in"
                ? "Schicht läuft bereits."
                : data.error === "request_already_pending"
                  ? "Es gibt bereits eine offene Anfrage."
                  : "Anfrage fehlgeschlagen.",
        );
        return;
      }
      toast.success("Startzeit-Anfrage gesendet.");
      await refresh();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-28 rounded-2xl border border-border/50 bg-card/60"
        aria-busy="true"
      />
    );
  }

  if (pendingRequest) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-4 text-center shadow-card">
        <p className="text-sm font-medium text-foreground">
          Startzeit-Anfrage ausstehend
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {timeFmt.format(new Date(pendingRequest.requested_starts_at))}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Wird im Dashboard geprüft — du erhältst eine Rückmeldung am Display.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card px-4 py-4 shadow-card">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="size-4 text-muted-foreground" />
        Startzeit nachtragen
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Vergessen einzustempeln? Startzeit anfragen — Freigabe im Dashboard.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="time"
          value={timeValue}
          disabled={disabled || busy}
          onChange={(e) => setTimeValue(e.target.value)}
          className={cn(formScheduleTimeInputClassName, "w-full sm:max-w-[9rem]")}
        />
        <Button
          type="button"
          disabled={disabled || busy}
          className={cn("w-full sm:flex-1", brandActionButtonRoundedClassName)}
          onClick={() => void submitRequest()}
        >
          <Send className="size-4" />
          Anfrage senden
        </Button>
      </div>
    </div>
  );
}

export type DisplayTimeRequestResolution = {
  id: string;
  status: "approved" | "declined";
  requested_starts_at: string;
  reviewed_at: string | null;
};

export async function fetchDisplayTimeRequestResolutions(): Promise<
  DisplayTimeRequestResolution[]
> {
  const res = await fetch("/api/display/time/request", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    unacknowledged_resolutions?: DisplayTimeRequestResolution[];
  };
  return data.unacknowledged_resolutions ?? [];
}

export async function acknowledgeDisplayTimeRequestResolutions(
  requestIds: string[],
): Promise<void> {
  if (requestIds.length === 0) return;
  await fetch("/api/display/time/request", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ request_ids: requestIds }),
  });
}
