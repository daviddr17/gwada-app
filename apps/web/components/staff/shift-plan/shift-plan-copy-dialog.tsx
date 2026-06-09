"use client";

import { ArrowDown, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  staffDrawerFieldClassName,
  staffDrawerScrollClassName,
} from "@/components/staff/staff-form-field-styles";
import {
  copyScheduledShiftsToRange,
  fetchScheduledShiftsInRange,
} from "@/lib/supabase/staff-shift-schedule-db";
import {
  copyPeriodDayOffset,
  daysInView,
  defaultCopyTargetYmd,
  formatShiftPlanPeriodLabel,
  getShiftPlanCopyUiCopy,
  localDayKey,
  parseLocalDayKey,
  SHIFT_SCHEDULE_VIEW_SELECT_OPTIONS,
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

const shiftPlanCopyScopeSelectClassName = appSelectTriggerAccentCn(
  cn(staffDrawerFieldClassName, "w-full min-w-0"),
);

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

  const uiCopy = useMemo(
    () => getShiftPlanCopyUiCopy(sourceYmd, sourceScope, targetYmd, targetScope),
    [sourceScope, sourceYmd, targetScope, targetYmd],
  );

  const summaryText = useMemo(
    () => uiCopy.summary(sourceLabel, targetLabel),
    [sourceLabel, targetLabel, uiCopy],
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
        "Quelle und Ziel liegen am selben Tag — bitte ein anderes Zieldatum wählen.",
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
    setTargetScope(next);
    setTargetYmd(defaultCopyTargetYmd(sourceYmd, next));
  };

  const handleSourceYmdChange = (ymd: string) => {
    setSourceYmd(ymd);
    setTargetYmd(defaultCopyTargetYmd(ymd, sourceScope));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Schichten kopieren
          </DrawerTitle>
          <DrawerDescription className="text-base">{uiCopy.drawerHint}</DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void runCopy();
          }}
        >
          <div className={cn(staffDrawerScrollClassName, "space-y-4 px-6 pb-4")}>
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Von
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="copy-source-scope">Zeitraum</Label>
                  <SearchableSelect
                    id="copy-source-scope"
                    options={SHIFT_SCHEDULE_VIEW_SELECT_OPTIONS}
                    value={sourceScope}
                    onValueChange={(v) =>
                      handleSourceScopeChange(v as ShiftScheduleViewMode)
                    }
                    placeholder="Zeitraum wählen"
                    searchPlaceholder="Zeitraum suchen…"
                    aria-label="Quell-Zeitraum"
                    className={shiftPlanCopyScopeSelectClassName}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>{uiCopy.sourceDateFieldLabel}</Label>
                  <DatePickerField
                    value={sourceYmd}
                    fullWidth
                    onChange={(v) => {
                      if (!v) return;
                      handleSourceYmdChange(v);
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
              <div className="grid min-w-0 grid-cols-1 gap-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="copy-target-scope">Zeitraum</Label>
                  <SearchableSelect
                    id="copy-target-scope"
                    options={SHIFT_SCHEDULE_VIEW_SELECT_OPTIONS}
                    value={targetScope}
                    onValueChange={(v) =>
                      setTargetScope(v as ShiftScheduleViewMode)
                    }
                    placeholder="Zeitraum wählen"
                    searchPlaceholder="Zeitraum suchen…"
                    aria-label="Ziel-Zeitraum"
                    className={shiftPlanCopyScopeSelectClassName}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>{uiCopy.targetDateFieldLabel}</Label>
                  <DatePickerField
                    value={targetYmd}
                    fullWidth
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
                "rounded-md border px-3 py-2 text-sm leading-relaxed",
                samePeriod
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-border/50 bg-card text-muted-foreground",
              )}
            >
              {samePeriod ? (
                "Quelle und Ziel sind identisch."
              ) : (
                <>
                  <Copy className="mr-1.5 inline size-3.5 shrink-0 align-text-bottom opacity-70" />
                  {summaryText}
                </>
              )}
            </div>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="submit"
            submitLabel="Kopieren"
            submitPending={pending}
            submitDisabled={samePeriod || countLoading}
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
