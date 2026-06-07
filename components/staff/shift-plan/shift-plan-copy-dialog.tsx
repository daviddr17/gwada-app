"use client";

import { ArrowDown, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  copyScheduledShiftsToRange,
  fetchScheduledShiftsInRange,
} from "@/lib/supabase/staff-shift-schedule-db";
import {
  copyPeriodDayOffset,
  daysInView,
  defaultCopyTargetYmd,
  formatShiftPlanPeriodLabel,
  localDayKey,
  parseLocalDayKey,
  SHIFT_SCHEDULE_VIEW_LABELS,
  viewRangeUtcIso,
} from "@/lib/staff/shift-schedule-range";
import type { ShiftScheduleViewMode } from "@/lib/types/staff-shift-schedule";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type ShiftPlanCopyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  anchor: Date;
  view: ShiftScheduleViewMode;
  requiresAcceptance: boolean;
  onCopied: () => void;
};

function periodDayCount(scope: ShiftScheduleViewMode, ymd: string): number {
  return daysInView(parseLocalDayKey(ymd), scope).length;
}

export function ShiftPlanCopyDialog({
  open,
  onOpenChange,
  restaurantId,
  anchor,
  view,
  requiresAcceptance,
  onCopied,
}: ShiftPlanCopyDialogProps) {
  const initialSourceYmd = localDayKey(anchor);

  const [sourceScope, setSourceScope] = useState<ShiftScheduleViewMode>(view);
  const [sourceYmd, setSourceYmd] = useState(initialSourceYmd);
  const [targetScope, setTargetScope] = useState<ShiftScheduleViewMode>(view);
  const [targetYmd, setTargetYmd] = useState(() =>
    defaultCopyTargetYmd(initialSourceYmd, view),
  );
  const [shiftCount, setShiftCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ymd = localDayKey(anchor);
    setSourceScope(view);
    setSourceYmd(ymd);
    setTargetScope(view);
    setTargetYmd(defaultCopyTargetYmd(ymd, view));
  }, [open, anchor, view]);

  const sourceRange = useMemo(
    () => viewRangeUtcIso(parseLocalDayKey(sourceYmd), sourceScope),
    [sourceScope, sourceYmd],
  );

  const dayOffset = useMemo(
    () => copyPeriodDayOffset(sourceYmd, sourceScope, targetYmd, targetScope),
    [sourceScope, sourceYmd, targetScope, targetYmd],
  );

  const sourceLabel = useMemo(
    () => formatShiftPlanPeriodLabel(sourceYmd, sourceScope),
    [sourceScope, sourceYmd],
  );

  const targetLabel = useMemo(
    () => formatShiftPlanPeriodLabel(targetYmd, targetScope),
    [targetScope, targetYmd],
  );

  const sourceDays = periodDayCount(sourceScope, sourceYmd);
  const targetDays = periodDayCount(targetScope, targetYmd);

  const samePeriod =
    dayOffset === 0 &&
    sourceYmd === targetYmd &&
    sourceScope === targetScope;

  useEffect(() => {
    if (!open) {
      setShiftCount(null);
      return;
    }

    let cancelled = false;
    setCountLoading(true);
    void fetchScheduledShiftsInRange(
      restaurantId,
      sourceRange.rangeStart,
      sourceRange.rangeEnd,
    ).then(({ data, error }) => {
      if (cancelled) return;
      setCountLoading(false);
      if (error) {
        setShiftCount(null);
        return;
      }
      setShiftCount(data?.length ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [open, restaurantId, sourceRange.rangeEnd, sourceRange.rangeStart]);

  const runCopy = async () => {
    if (samePeriod) {
      toast.error("Quelle und Ziel dürfen nicht identisch sein.");
      return;
    }
    if (dayOffset === 0) {
      toast.error(
        "Quelle und Ziel beginnen am selben Tag — bitte ein anderes Zieldatum wählen.",
      );
      return;
    }

    setPending(true);
    const { count, error } = await copyScheduledShiftsToRange(
      restaurantId,
      sourceRange.rangeStart,
      sourceRange.rangeEnd,
      dayOffset,
      { requiresAcceptance },
    );
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }
    if (count === 0) {
      toast.message("Keine Schichten zum Kopieren im Quellzeitraum.");
      return;
    }
    toast.success(`${count} Schicht${count === 1 ? "" : "en"} kopiert.`);
    onCopied();
    onOpenChange(false);
  };

  const handleSourceScopeChange = (next: ShiftScheduleViewMode) => {
    setSourceScope(next);
    setTargetYmd(defaultCopyTargetYmd(sourceYmd, next));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schichten kopieren</DialogTitle>
          <DialogDescription>
            Wähle Quelle und Ziel — alle Schichten im Quellzeitraum werden
            verschoben kopiert (Tag, Woche oder Monat).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Von
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="copy-source-scope">Zeitraum</Label>
                <Select
                  value={sourceScope}
                  onValueChange={(v) =>
                    handleSourceScopeChange(v as ShiftScheduleViewMode)
                  }
                >
                  <SelectTrigger
                    id="copy-source-scope"
                    className={appSelectTriggerAccentCn("h-10 w-full")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SHIFT_SCHEDULE_VIEW_LABELS) as ShiftScheduleViewMode[]).map(
                      (mode) => (
                        <SelectItem key={mode} value={mode}>
                          {SHIFT_SCHEDULE_VIEW_LABELS[mode]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum</Label>
                <DatePickerField
                  value={sourceYmd}
                  onChange={(v) => {
                    if (!v) return;
                    setSourceYmd(v);
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-foreground">{sourceLabel}</p>
            <p className="text-xs text-muted-foreground">
              {sourceDays} Tag{sourceDays === 1 ? "" : "e"}
              {countLoading
                ? " · Schichten werden gezählt …"
                : shiftCount != null
                  ? ` · ${shiftCount} Schicht${shiftCount === 1 ? "" : "en"}`
                  : null}
            </p>
          </div>

          <div className="flex justify-center" aria-hidden>
            <ArrowDown className="size-4 text-muted-foreground" />
          </div>

          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nach
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="copy-target-scope">Zeitraum</Label>
                <Select
                  value={targetScope}
                  onValueChange={(v) =>
                    setTargetScope(v as ShiftScheduleViewMode)
                  }
                >
                  <SelectTrigger
                    id="copy-target-scope"
                    className={appSelectTriggerAccentCn("h-10 w-full")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SHIFT_SCHEDULE_VIEW_LABELS) as ShiftScheduleViewMode[]).map(
                      (mode) => (
                        <SelectItem key={mode} value={mode}>
                          {SHIFT_SCHEDULE_VIEW_LABELS[mode]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ziel ab</Label>
                <DatePickerField
                  value={targetYmd}
                  onChange={(v) => {
                    if (!v) return;
                    setTargetYmd(v);
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-foreground">{targetLabel}</p>
            <p className="text-xs text-muted-foreground">
              {targetDays} Tag{targetDays === 1 ? "" : "e"}
              {dayOffset !== 0 ? (
                <>
                  {" "}
                  · Verschiebung{" "}
                  {dayOffset > 0 ? `+${dayOffset}` : dayOffset} Tag
                  {Math.abs(dayOffset) === 1 ? "" : "e"}
                </>
              ) : null}
            </p>
          </div>

          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              samePeriod
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-border/50 bg-card text-muted-foreground",
            )}
          >
            {samePeriod ? (
              "Quelle und Ziel sind identisch."
            ) : (
              <>
                <Copy className="mr-1.5 inline size-3.5 align-text-bottom opacity-70" />
                Schichten aus{" "}
                <span className="font-medium text-foreground">{sourceLabel}</span>{" "}
                werden ab{" "}
                <span className="font-medium text-foreground">{targetLabel}</span>{" "}
                eingetragen.
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => void runCopy()}
            disabled={pending || samePeriod || countLoading}
          >
            Kopieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
