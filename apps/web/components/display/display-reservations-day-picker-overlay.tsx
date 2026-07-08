"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { format, isValid } from "date-fns";
import { de } from "date-fns/locale";
import { de as localeDe } from "react-day-picker/locale";
import type { DayButton } from "react-day-picker";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Minimize2 } from "lucide-react";
import { AppFullscreenOverlay, appFullscreenOverlayScrollClassName } from "@/components/ui/app-fullscreen-overlay";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { DisplayReservationDayStat } from "@/lib/display/display-reservations-server";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { moduleTableFullscreenToggleButtonClassName } from "@/lib/ui/module-paginated-data-table";
import { moduleTableFullscreenChromeInsetClassName } from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function parseYmdToDate(ymd: string | null | undefined): Date | undefined {
  if (!ymd?.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }
  const d = new Date(year, month - 1, day);
  return isValid(d) ? d : undefined;
}

function ymdFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function monthKeyFromCursor(cursor: { year: number; month: number }): string {
  return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
}

type DisplayReservationsDayPickerOverlayProps = {
  open: boolean;
  onClose: () => void;
  selectedDayYmd: string;
  onSelectDay: (ymd: string) => void;
  timeZone: string;
};

export function DisplayReservationsDayPickerTrigger({
  selectedDayYmd,
  onClick,
  disabled,
  className,
}: {
  selectedDayYmd: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = parseYmdToDate(selectedDayYmd);
  const labelText = selected
    ? format(selected, "P", { locale: de })
    : "Datum wählen";

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-9 w-[200px] shrink-0 justify-between gap-2 rounded-xl border border-input bg-transparent px-3 text-left text-sm font-normal shadow-none",
        "text-foreground outline-none transition-colors",
        "hover:bg-muted/50 dark:bg-input/30 dark:hover:bg-input/40",
        "focus:border-ring focus:ring-3 focus:ring-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:disabled:bg-input/80",
        "active:!translate-y-0 touch-manipulation",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <CalendarIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="truncate">{labelText}</span>
      </span>
    </Button>
  );
}

export function DisplayReservationsDayPickerOverlay({
  open,
  onClose,
  selectedDayYmd,
  onSelectDay,
  timeZone,
}: DisplayReservationsDayPickerOverlayProps) {
  const selectedDate = useMemo(
    () => parseYmdToDate(selectedDayYmd),
    [selectedDayYmd],
  );
  const todayYmd = restaurantTodayYmd(timeZone);
  const todayDate = useMemo(() => parseYmdToDate(todayYmd), [todayYmd]);

  const [cursor, setCursor] = useState(() => {
    const d = parseYmdToDate(selectedDayYmd) ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [dayStats, setDayStats] = useState<
    Record<string, DisplayReservationDayStat>
  >({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = parseYmdToDate(selectedDayYmd) ?? new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, [open, selectedDayYmd]);

  const monthKey = monthKeyFromCursor(cursor);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatsLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/display/reservations/calendar?month=${encodeURIComponent(monthKey)}`,
        );
        const data = (await res.json()) as {
          error?: string;
          days?: Record<string, DisplayReservationDayStat>;
        };
        if (cancelled) return;
        if (!res.ok) {
          setDayStats({});
          return;
        }
        setDayStats(data.days ?? {});
      } catch {
        if (!cancelled) setDayStats({});
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, monthKey]);

  const monthItems = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 12 }, (_, m) => [
          String(m),
          new Intl.DateTimeFormat("de-DE", { month: "long" }).format(
            new Date(2000, m, 1),
          ),
        ]),
      ),
    [],
  );

  const nowY = (todayDate ?? new Date()).getFullYear();
  const yearMin = nowY - 1;
  const yearMax = nowY + 2;
  const yearItems = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: yearMax - yearMin + 1 }, (_, i) => {
          const y = yearMin + i;
          return [String(y), String(y)];
        }),
      ),
    [yearMax, yearMin],
  );

  const prevMonth = useCallback(() => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const StatsDayButton = useMemo(() => {
    function DayButtonWithStats(props: ComponentProps<typeof DayButton>) {
      const { day, modifiers, className, ...rest } = props;
      const ymd = ymdFromDate(day.date);
      const stats = dayStats[ymd];
      const hasStats = stats && stats.count > 0;

      return (
        <Button
          type="button"
          variant="ghost"
          data-day={day.date.toLocaleDateString("de")}
          data-today={modifiers.today ? "" : undefined}
          data-selected-single={
            modifiers.selected &&
            !modifiers.range_start &&
            !modifiers.range_end &&
            !modifiers.range_middle
              ? ""
              : undefined
          }
          className={cn(
            "relative z-10 flex h-full min-h-[4.5rem] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-0 p-1.5 font-normal leading-tight transition-colors",
            "text-foreground hover:bg-muted/70 hover:text-foreground",
            "aria-disabled:pointer-events-none aria-disabled:opacity-40",
            modifiers.today && "font-semibold",
            modifiers.selected &&
              "bg-muted text-foreground ring-2 ring-ring/40",
            className,
          )}
          {...rest}
        >
          <span className="text-lg font-semibold tabular-nums sm:text-xl">
            {day.date.getDate()}
          </span>
          {hasStats ? (
            <span className="max-w-full px-0.5 text-center text-[11px] leading-tight text-muted-foreground sm:text-xs">
              <span className="block tabular-nums">
                {stats.count} Res.
              </span>
              <span className="block tabular-nums">{stats.guests} Pers.</span>
            </span>
          ) : statsLoading ? (
            <span className="h-6 w-10 rounded bg-muted/60" aria-hidden />
          ) : (
            <span className="text-[10px] text-muted-foreground/50">—</span>
          )}
        </Button>
      );
    }
    DayButtonWithStats.displayName = "DisplayStatsDayButton";
    return DayButtonWithStats;
  }, [dayStats, statsLoading]);

  const calendarMonth = useMemo(
    () => new Date(cursor.year, cursor.month, 1),
    [cursor.year, cursor.month],
  );

  return (
    <AppFullscreenOverlay
      open={open}
      onClose={onClose}
      aria-label="Kalender — Tag wählen"
      header={
        <div
          className={cn(
            "flex w-full items-center justify-between gap-3 py-3",
            moduleTableFullscreenChromeInsetClassName,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              onClick={prevMonth}
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Select
              value={String(cursor.month)}
              items={monthItems}
              onValueChange={(v) => {
                if (typeof v === "string") {
                  setCursor((c) => ({ ...c, month: Number.parseInt(v, 10) }));
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className={appSelectTriggerAccentCn(
                  "h-10 min-h-10 min-w-[9.5rem] max-w-[min(100%,12rem)] shrink rounded-xl px-2.5 text-left text-sm font-normal",
                  selectValueNoShrink,
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, m) => (
                  <SelectItem key={m} value={String(m)}>
                    {monthItems[String(m)]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(cursor.year)}
              items={yearItems}
              onValueChange={(v) => {
                if (typeof v === "string") {
                  setCursor((c) => ({ ...c, year: Number.parseInt(v, 10) }));
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className={appSelectTriggerAccentCn(
                  "h-10 min-h-10 w-[5.5rem] shrink-0 rounded-xl px-2.5 text-sm font-normal",
                  selectValueNoShrink,
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: yearMax - yearMin + 1 }, (_, i) => {
                  const y = yearMin + i;
                  return (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              onClick={nextMonth}
              aria-label="Nächster Monat"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={moduleTableFullscreenToggleButtonClassName}
            onClick={onClose}
            aria-label="Kalender verkleinern"
          >
            <Minimize2 className="size-4" />
          </Button>
        </div>
      }
      footer={
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 py-3",
            moduleTableFullscreenChromeInsetClassName,
          )}
        >
          <p className="text-xs text-muted-foreground">
            Unter jedem Tag: Reservierungen und Personen im gewählten Monat.
          </p>
          <Button
            type="button"
            className={cn(brandActionButtonRoundedClassName, "h-11 px-6")}
            onClick={onClose}
          >
            Fertig
          </Button>
        </div>
      }
    >
      <div
        className={cn(
          appFullscreenOverlayScrollClassName,
          "flex min-h-0 w-full flex-1 flex-col px-2 py-2 sm:px-4 sm:py-3",
        )}
      >
        {statsLoading && Object.keys(dayStats).length === 0 ? (
          <div className="flex min-h-0 w-full flex-1 flex-col space-y-3" aria-busy>
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="min-h-[50dvh] w-full flex-1 rounded-2xl" />
          </div>
        ) : (
          <Calendar
            className={cn(
              "w-full max-w-none flex-1 bg-transparent p-1 sm:p-2",
              "[--cell-size:clamp(3rem,calc((100dvw-2rem)/7),6rem)]",
            )}
            classNames={{
              root: "w-full max-w-none",
              months: "relative w-full",
              month: "flex w-full flex-col gap-2 sm:gap-3",
              month_caption: "hidden",
              nav: "hidden",
              month_grid: "w-full table-fixed",
              weekdays: "w-full",
              weekday: "h-auto pb-2 text-xs font-medium sm:text-sm",
              week: "h-[calc((100dvh-13rem)/6)] min-h-[4.5rem]",
              day: "h-full p-0.5",
            }}
            locale={localeDe}
            mode="single"
            month={calendarMonth}
            onMonthChange={(d) => {
              setCursor({ year: d.getFullYear(), month: d.getMonth() });
            }}
            selected={selectedDate}
            today={todayDate}
            showOutsideDays
            components={{
              DayButton: StatsDayButton,
            }}
            onSelect={(d) => {
              if (!d) return;
              onSelectDay(ymdFromDate(d));
              onClose();
            }}
          />
        )}
      </div>
    </AppFullscreenOverlay>
  );
}
