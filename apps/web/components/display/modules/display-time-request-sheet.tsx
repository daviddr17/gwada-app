"use client";

import { useCallback, useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DatePickerField,
  formScheduleTimeInputClassName,
} from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DrawerFormBody,
  DrawerFormScrollArea,
  DrawerFormSection,
} from "@/components/ui/drawer-form-section";
import { drawerFormFooterShellClassName } from "@/components/ui/drawer-form-footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import {
  drawerFormFieldClassName,
  drawerFormHeaderClassName,
} from "@/lib/ui/drawer-form-section";
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

type SheetTab = "new" | "pending";

const CONTENT_PADDING = 6 as const;

const entryTypeItems = DISPLAY_TIME_REQUEST_ENTRY_TYPES.map((type) => ({
  value: type,
  label: STAFF_WORK_ENTRY_LABELS[type],
}));

function defaultNachtragenDateYmd(): string {
  return format(subDays(new Date(), 1), "yyyy-MM-dd");
}

function defaultLocalTimeValue(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function defaultFormState() {
  return {
    dateYmd: defaultNachtragenDateYmd(),
    startTime: defaultLocalTimeValue(9),
    endTime: defaultLocalTimeValue(17),
    entryType: "work" as DisplayTimeRequestEntryType,
  };
}

const rangeFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("de-DE", {
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

function PendingRequestCard({ request }: { request: PendingRequest }) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-4">
      <p className="text-sm font-medium">Anfrage ausstehend</p>
      <p className="mt-2 text-base font-medium">
        {STAFF_WORK_ENTRY_LABELS[request.entry_type]}
      </p>
      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
        {rangeFmt.format(new Date(request.requested_starts_at))}
        {" – "}
        {timeFmt.format(new Date(request.requested_ends_at))}
      </p>
    </div>
  );
}

function NachtragenFormFields({
  dateYmd,
  setDateYmd,
  entryType,
  setEntryType,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  disabled,
}: {
  dateYmd: string;
  setDateYmd: (value: string) => void;
  entryType: DisplayTimeRequestEntryType;
  setEntryType: (value: DisplayTimeRequestEntryType) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <DrawerFormSection contentPadding={CONTENT_PADDING}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Datum</Label>
          <DatePickerField
            fullWidth
            value={dateYmd}
            onChange={(v) => setDateYmd(v ?? defaultNachtragenDateYmd())}
            disabled={disabled}
            className="w-full"
          />
        </div>
      </DrawerFormSection>

      <DrawerFormSection contentPadding={CONTENT_PADDING}>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Art</Label>
          <Select
            value={entryType}
            items={entryTypeItems}
            onValueChange={(v) => {
              if (typeof v === "string") {
                setEntryType(v as DisplayTimeRequestEntryType);
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn(
                drawerFormFieldClassName,
                "text-left font-normal",
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <StaffWorkEntryTypeStripe
                  type={entryType as StaffWorkEntryType}
                  className="h-4 shrink-0 self-center"
                />
                <SelectValue placeholder="Art wählen">
                  {STAFF_WORK_ENTRY_LABELS[entryType]}
                </SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent>
              {DISPLAY_TIME_REQUEST_ENTRY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    <StaffWorkEntryTypeStripe
                      type={type}
                      className="h-4 shrink-0 self-center"
                    />
                    {STAFF_WORK_ENTRY_LABELS[type]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DrawerFormSection>

      <DrawerFormSection contentPadding={CONTENT_PADDING}>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label
              htmlFor="display-time-request-start"
              className="text-xs text-muted-foreground"
            >
              Von
            </Label>
            <input
              id="display-time-request-start"
              type="time"
              value={startTime}
              disabled={disabled}
              onChange={(e) => setStartTime(e.target.value)}
              className={formScheduleTimeInputClassName}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label
              htmlFor="display-time-request-end"
              className="text-xs text-muted-foreground"
            >
              Bis
            </Label>
            <input
              id="display-time-request-end"
              type="time"
              value={endTime}
              disabled={disabled}
              onChange={(e) => setEndTime(e.target.value)}
              className={formScheduleTimeInputClassName}
            />
          </div>
        </div>
      </DrawerFormSection>
    </>
  );
}

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
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<SheetTab>("new");
  const [dateYmd, setDateYmd] = useState(defaultNachtragenDateYmd);
  const [startTime, setStartTime] = useState(() => defaultLocalTimeValue(9));
  const [endTime, setEndTime] = useState(() => defaultLocalTimeValue(17));
  const [entryType, setEntryType] = useState<DisplayTimeRequestEntryType>("work");

  const resetForm = useCallback(() => {
    const defaults = defaultFormState();
    setDateYmd(defaults.dateYmd);
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    setEntryType(defaults.entryType);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/display/time/request", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        pending_requests?: PendingRequest[];
      };
      setPendingRequests(data.pending_requests ?? []);
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

  useEffect(() => {
    if (!open || loading) return;
    if (pendingRequests.length > 0) {
      setTab("pending");
    } else {
      setTab("new");
      resetForm();
    }
  }, [open, loading, pendingRequests.length, resetForm]);

  useEffect(() => {
    if (!open || loading || tab !== "new") return;
    resetForm();
  }, [open, loading, tab, resetForm]);

  const hasPending = pendingRequests.length > 0;
  const showForm = !hasPending || tab === "new";

  const submitRequest = async () => {
    if (busy || disabled) return;
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
                  : "Anfrage fehlgeschlagen.",
        );
        return;
      }
      toast.success("Nachtragungs-Anfrage gesendet.");
      await refresh();
      onChanged?.();
      setTab("pending");
      resetForm();
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
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className={drawerFormHeaderClassName(CONTENT_PADDING)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Zeit nachtragen
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            Datum, Zeitraum und Art angeben — Freigabe im Dashboard.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
          {loading ? (
            <DrawerFormScrollArea contentPadding={CONTENT_PADDING}>
              <div className="min-h-32" aria-busy="true" />
            </DrawerFormScrollArea>
          ) : hasPending ? (
            <Tabs
              value={tab}
              onValueChange={(value) => {
                if (value === "new" || value === "pending") setTab(value);
              }}
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
            >
              <TabsList
                className={cn(
                  "mx-6 h-11 w-auto shrink-0 self-stretch rounded-xl p-1",
                )}
              >
                <TabsTrigger value="pending" className="flex-1 rounded-lg">
                  Ausstehend ({pendingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="new" className="flex-1 rounded-lg">
                  Neu
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="min-h-0 flex-1">
                <DrawerFormScrollArea
                  contentPadding={CONTENT_PADDING}
                  className="space-y-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Wird im Dashboard geprüft — Rückmeldung beim nächsten Login.
                  </p>
                  {pendingRequests.map((request) => (
                    <PendingRequestCard key={request.id} request={request} />
                  ))}
                </DrawerFormScrollArea>
              </TabsContent>

              <TabsContent value="new" className="min-h-0 flex-1">
                <DrawerFormScrollArea
                  contentPadding={CONTENT_PADDING}
                  className="space-y-0"
                >
                  <NachtragenFormFields
                    dateYmd={dateYmd}
                    setDateYmd={setDateYmd}
                    entryType={entryType}
                    setEntryType={setEntryType}
                    startTime={startTime}
                    setStartTime={setStartTime}
                    endTime={endTime}
                    setEndTime={setEndTime}
                    disabled={disabled || busy}
                  />
                </DrawerFormScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <DrawerFormScrollArea
              contentPadding={CONTENT_PADDING}
              className="space-y-0"
            >
              <NachtragenFormFields
                dateYmd={dateYmd}
                setDateYmd={setDateYmd}
                entryType={entryType}
                setEntryType={setEntryType}
                startTime={startTime}
                setStartTime={setStartTime}
                endTime={endTime}
                setEndTime={setEndTime}
                disabled={disabled || busy}
              />
            </DrawerFormScrollArea>
          )}

          {showForm && !loading ? (
            <div
              data-vaul-no-drag
              className={drawerFormFooterShellClassName(CONTENT_PADDING)}
            >
              <Button
                type="button"
                disabled={disabled || busy}
                className={cn("h-12 w-full", brandActionButtonRoundedClassName)}
                onClick={() => void submitRequest()}
              >
                <Send className="size-4" />
                {busy ? "Senden …" : "Anfrage senden"}
              </Button>
            </div>
          ) : null}
        </DrawerFormBody>
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
        pending_requests?: PendingRequest[];
      };
      setPending((data.pending_requests?.length ?? 0) > 0);
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
