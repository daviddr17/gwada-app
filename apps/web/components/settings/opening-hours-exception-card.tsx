"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField, formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openPeriodsAfterClosedInterval } from "@/lib/opening-hours/hours-periods";
import { weekdayFromDateYmd } from "@/lib/opening-hours/embed-display-utils";
import type {
  DateHoursException,
  DayHours,
  HoursPeriod,
  Weekday,
} from "@/lib/types/restaurant";

const DEFAULT_PERIOD: HoursPeriod = { open: "11:30", close: "22:00" };

function draftPeriods(exception: DateHoursException): HoursPeriod[] {
  if (exception.closed) return [];
  // Während der Eingabe Rohwerte behalten (nicht normalisieren — sonst
  // verschwindet das 2. Fenster / UI unmountet unter Fokus).
  if (exception.periods && exception.periods.length > 0) {
    return exception.periods.map((p) => ({
      open: p.open ?? "",
      close: p.close ?? "",
    }));
  }
  if (exception.open || exception.close) {
    return [{ open: exception.open ?? "", close: exception.close ?? "" }];
  }
  return [{ ...DEFAULT_PERIOD }];
}

function patchOpenPeriods(
  periods: HoursPeriod[],
): Pick<DateHoursException, "closed" | "periods" | "open" | "close"> {
  return {
    closed: false,
    periods,
    open: periods[0]?.open || undefined,
    close: periods[periods.length - 1]?.close || undefined,
  };
}

/** Ein weiteres Fenster — bei einem Volltag-Fenster sinnvoll aufteilen. */
function withAddedPeriod(periods: HoursPeriod[]): HoursPeriod[] {
  if (periods.length === 1) {
    const only = periods[0]!;
    const open = only.open?.trim() || DEFAULT_PERIOD.open;
    const close = only.close?.trim() || DEFAULT_PERIOD.close;
    if (open < "14:30" && close > "17:30") {
      return [
        { open, close: "14:30" },
        { open: "17:30", close },
      ];
    }
  }
  return [...periods, { open: "17:30", close: "22:00" }];
}

export function OpeningHoursExceptionCard({
  exception,
  weeklyHours,
  onChange,
  onRemove,
}: {
  exception: DateHoursException;
  weeklyHours: Record<Weekday, DayHours>;
  onChange: (patch: Partial<DateHoursException>) => void;
  onRemove: () => void;
}) {
  const periods = draftPeriods(exception);
  const [pauseFrom, setPauseFrom] = useState("14:30");
  const [pauseTo, setPauseTo] = useState("17:30");
  const [pauseError, setPauseError] = useState<string | null>(null);

  const setPeriods = (next: HoursPeriod[]) => {
    const safe = next.length > 0 ? next : [{ open: "11:30", close: "22:00" }];
    onChange(patchOpenPeriods(safe));
  };

  const applyPause = () => {
    const weekday = weekdayFromDateYmd(exception.date);
    const result = openPeriodsAfterClosedInterval(
      weeklyHours[weekday],
      pauseFrom,
      pauseTo,
    );
    if ("error" in result) {
      setPauseError(result.error);
      return;
    }
    setPauseError(null);
    onChange({
      ...patchOpenPeriods(result),
      note: exception.note?.trim()
        ? exception.note
        : `Geschlossen ${pauseFrom}–${pauseTo}`,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/40 bg-muted/15 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Datum</Label>
          <DatePickerField
            value={exception.date}
            onChange={(d) => {
              if (d) onChange({ date: d });
            }}
            placeholder="Datum wählen"
            className="max-w-[min(100%,18rem)]"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <Checkbox
            checked={exception.closed}
            onCheckedChange={(v) =>
              onChange(
                v === true
                  ? {
                      closed: true,
                      open: undefined,
                      close: undefined,
                      periods: undefined,
                    }
                  : patchOpenPeriods(
                      periods.length > 0 ? periods : [{ ...DEFAULT_PERIOD }],
                    ),
              )
            }
          />
          Ganztägig geschlossen
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ms-auto shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Ausnahme entfernen"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {!exception.closed ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Offene Zeitfenster</Label>
            <p className="text-xs text-muted-foreground">
              Mehrere Fenster = Pause dazwischen (so übernimmt es auch Google).
            </p>
            <div className="space-y-2">
              {periods.map((period, index) => (
                <div
                  key={`${exception.id}-period-${index}`}
                  className="flex min-h-11 flex-wrap items-center gap-2"
                >
                  <Input
                    type="time"
                    value={period.open}
                    onChange={(e) => {
                      const next = [...periods];
                      next[index] = { ...next[index]!, open: e.target.value };
                      setPeriods(next);
                    }}
                    className={formScheduleTimeInputClassName}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={period.close}
                    onChange={(e) => {
                      const next = [...periods];
                      next[index] = { ...next[index]!, close: e.target.value };
                      setPeriods(next);
                    }}
                    className={formScheduleTimeInputClassName}
                  />
                  {periods.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Zeitfenster entfernen"
                      onClick={() =>
                        setPeriods(periods.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => setPeriods(withAddedPeriod(periods))}
            >
              <Plus className="size-3.5" />
              Zeitfenster
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border/40 bg-background/60 p-3">
            <Label className="text-xs">Zeitweise geschlossen (aus Wochenplan)</Label>
            <p className="text-xs text-muted-foreground">
              z. B. 14:30–17:30 — öffnet die restlichen Fenster aus dem regulären
              Tag und speichert das Google-kompatibel als zwei Perioden.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="time"
                value={pauseFrom}
                onChange={(e) => setPauseFrom(e.target.value)}
                className={formScheduleTimeInputClassName}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={pauseTo}
                onChange={(e) => setPauseTo(e.target.value)}
                className={formScheduleTimeInputClassName}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={applyPause}
              >
                Übernehmen
              </Button>
            </div>
            {pauseError ? (
              <p className="text-xs text-destructive">{pauseError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label className="text-xs">Notiz (optional)</Label>
        <Input
          value={exception.note ?? ""}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="z. B. Wegen Wetter / Nur Abholung"
          className="h-10 rounded-lg"
        />
      </div>
    </div>
  );
}
