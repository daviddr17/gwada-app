"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formScheduleTimeInputClassName } from "@/components/ui/date-picker";
import {
  WEEKDAY_LABEL_DE,
  WEEKDAY_ORDER,
} from "@/lib/constants/restaurant-profile";
import type { DayHours, Weekday } from "@/lib/types/restaurant";

export function WeekdayHoursGrid({
  hours,
  onDayChange,
}: {
  hours: Record<Weekday, DayHours>;
  onDayChange: (day: Weekday, patch: Partial<DayHours>) => void;
}) {
  return (
    <div className="space-y-3 pt-1">
      {WEEKDAY_ORDER.map((day) => {
        const h = hours[day];
        return (
          <div
            key={day}
            className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="min-w-[7.5rem] text-sm font-medium">
              {WEEKDAY_LABEL_DE[day]}
            </span>
            <div className="flex min-h-11 flex-wrap items-center gap-3 sm:flex-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={h.closed}
                  onCheckedChange={(v) =>
                    onDayChange(day, { closed: v === true })
                  }
                />
                Geschlossen
              </label>
              {!h.closed && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    value={h.open ?? ""}
                    onChange={(e) =>
                      onDayChange(day, { open: e.target.value })
                    }
                    className={formScheduleTimeInputClassName}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={h.close ?? ""}
                    onChange={(e) =>
                      onDayChange(day, { close: e.target.value })
                    }
                    className={formScheduleTimeInputClassName}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
