"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePickerField, formScheduleTimeInputFullWidthClassName } from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { DISPLAY_TIME_REQUEST_ENTRY_TYPES } from "@/lib/staff/staff-display-time-request-types";
import type { DisplayTimeRequestEntryType } from "@/lib/staff/staff-display-time-request-types";
import {
  STAFF_WORK_ENTRY_LABELS,
  type StaffWorkEntryType,
} from "@/lib/types/staff";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type PendingRequest = {
  id: string;
  entry_type: DisplayTimeRequestEntryType;
  requested_starts_at: string;
  requested_ends_at: string;
  created_at: string;
};

function todayYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function defaultLocalTimeValue(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const rangeFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type DisplayTimeRequestResolution = {
  id: string;
  status: "approved" | "declined";
  entry_type: DisplayTimeRequestEntryType;
  requested_starts_at: string;
  requested_ends_at: string;
  reviewed_at: string | null;
};

export function DisplayTimeRequestSheet({
  open,
  onOpenChange,
  disabled,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [startTime, setStartTime] = useState(() => defaultLocalTimeValue(9));
  const [endTime, setEndTime] = useState(() => defaultLocalTimeValue(17));
  const [entryType, setEntryType] = useState<DisplayTimeRequestEntryType>("work");

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

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const submitRequest = async () => {
    if (busy || disabled || pendingRequest) return;
    setBusy(true);
    try {
      const res = await fetch("/api/display/time/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: dateYmd,
          start_time: startTime,
          end_time: endTime,
          entry_type: entryType,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "date_in_future"
            ? "Das Datum liegt in der Zukunft."
            : data.error === "time_in_future"
              ? "Der Zeitraum liegt in der Zukunft."
              : data.error === "end_before_start"
                ? "Ende muss nach Beginn liegen."
                : data.error === "invalid_entry_type"
                  ? "Bitte eine gültige Art wählen."
                  : data.error === "request_already_pending"
                    ? "Es gibt bereits eine offene Anfrage."
                    : "Anfrage fehlgeschlagen.",
        );
        return;
      }
      toast.success("Nachtragungs-Anfrage gesendet.");
      onOpenChange(false);
      await refresh();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Zeit nachtragen
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            Datum, Zeitraum und Art angeben — Freigabe im Dashboard.
          </DrawerDescription>
        </DrawerHeader>

        <div className={cn(drawerScrollAreaClassName, "space-y-4 px-1 pb-2")}>
          {loading ? (
            <div className="min-h-32" aria-busy="true" />
          ) : pendingRequest ? (
            <div className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-4 text-center">
              <p className="text-sm font-medium">Anfrage ausstehend</p>
              <p className="mt-2 text-base font-medium">
                {STAFF_WORK_ENTRY_LABELS[pendingRequest.entry_type]}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {rangeFmt.format(new Date(pendingRequest.requested_starts_at))}
                {" – "}
                {new Intl.DateTimeFormat("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(pendingRequest.requested_ends_at))}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Wird im Dashboard geprüft — Rückmeldung beim nächsten Login.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Datum</Label>
                <DatePickerField
                  value={dateYmd}
                  onChange={(v) => setDateYmd(v ?? todayYmd())}
                  disabled={disabled || busy}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Art</Label>
                <Select
                  value={entryType}
                  onValueChange={(v) =>
                    setEntryType(v as DisplayTimeRequestEntryType)
                  }
                  disabled={disabled || busy}
                >
                  <SelectTrigger
                    className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}
                  >
                    <span className="flex items-center gap-2">
                      <StaffWorkEntryTypeStripe
                        type={entryType as StaffWorkEntryType}
                        className="h-4 self-center"
                      />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_TIME_REQUEST_ENTRY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center gap-2">
                          <StaffWorkEntryTypeStripe
                            type={type}
                            className="h-4 self-center"
                          />
                          {STAFF_WORK_ENTRY_LABELS[type]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="display-time-request-start">Von</Label>
                  <input
                    id="display-time-request-start"
                    type="time"
                    value={startTime}
                    disabled={disabled || busy}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={formScheduleTimeInputFullWidthClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-time-request-end">Bis</Label>
                  <input
                    id="display-time-request-end"
                    type="time"
                    value={endTime}
                    disabled={disabled || busy}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={formScheduleTimeInputFullWidthClassName}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && !pendingRequest ? (
          <div className="px-1 pb-1 pt-2">
            <Button
              type="button"
              disabled={disabled || busy}
              className={cn("w-full", brandActionButtonRoundedClassName)}
              onClick={() => void submitRequest()}
            >
              <Send className="size-4" />
              Anfrage senden
            </Button>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function useDisplayTimeRequestPending(): {
  pending: boolean;
  refresh: () => Promise<void>;
} {
  const [pending, setPending] = useState(false);

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
      setPending(Boolean(data.pending_request));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pending, refresh };
}

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
