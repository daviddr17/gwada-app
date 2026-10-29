"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo } from "react";
import { Flame } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  loginStreakCellsToWeekColumns,
  type LoginStreakSummary,
} from "@/lib/profile/login-streak";
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Fixed weekday gutter — labels must not shrink with fluid cells. */
const WEEKDAY_GUTTER = "1.5rem";
/** Below this, overflow-x scrolls instead of crushing tiles. */
const CELL_MIN = "0.625rem";
/**
 * Soft ceiling so 7×aspect-square rows stay compact on wide cards.
 * Grid uses `min(100%, maxWidth)` — fills the card until this size, then stops.
 */
const CELL_MAX = "0.875rem";
const CELL_GAP = "3px";

const STREAK_STALE_MS = 5 * 60_000;

async function fetchLoginStreakSummary(): Promise<LoginStreakSummary> {
  const res = await fetch("/api/profile/login-streak");
  if (!res.ok) throw new Error("streak_load_failed");
  const json = (await res.json()) as { data?: LoginStreakSummary };
  if (!json.data) throw new Error("streak_empty");
  return json.data;
}

function streakHeatmapTrackWidth(
  weekCount: number,
  cellSize: string,
): string {
  return `calc(${WEEKDAY_GUTTER} + ${weekCount} * ${cellSize} + ${weekCount} * ${CELL_GAP})`;
}

export function ProfileLoginStreakCard() {
  const query = useQuery({
    queryKey: queryKeys.profile.loginStreak(),
    queryFn: fetchLoginStreakSummary,
    staleTime: STREAK_STALE_MS,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const summary = query.data ?? null;
  const loading = query.isLoading && !summary;
  const error = query.isError ? "Streak konnte nicht geladen werden." : null;

  const columns = useMemo(
    () => (summary ? loginStreakCellsToWeekColumns(summary.cells) : []),
    [summary],
  );

  const weekCount = columns.length;

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Flame className="size-3.5" aria-hidden />
          </span>
          Login-Streak
        </CardTitle>
        <CardDescription>
          Tage, an denen du in Gwada aktiv warst.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : summary ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="flex min-w-0 items-baseline gap-1">
                  <span className="truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
                    {summary.currentStreak}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {summary.currentStreak === 1 ? "Tag" : "Tage"}
                  </span>
                </p>
                <p className="text-xs leading-snug text-muted-foreground">
                  aktuell
                </p>
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
                  {summary.longestStreak}
                </p>
                <p className="text-xs leading-snug text-muted-foreground">
                  Rekord
                </p>
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
                  {summary.totalDays}
                </p>
                <p className="text-xs leading-snug text-muted-foreground">
                  Gesamt
                </p>
              </div>
            </div>

            {weekCount > 0 ? (
              <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:thin]">
                <div
                  className="grid"
                  style={{
                    gap: CELL_GAP,
                    gridTemplateColumns: `${WEEKDAY_GUTTER} repeat(${weekCount}, minmax(${CELL_MIN}, 1fr))`,
                    width: `min(100%, ${streakHeatmapTrackWidth(weekCount, CELL_MAX)})`,
                    minWidth: streakHeatmapTrackWidth(weekCount, CELL_MIN),
                  }}
                  role="img"
                  aria-label="Aktivitäts-Heatmap der letzten Wochen"
                >
                  {WEEKDAY_LABELS.map((label, rowIndex) => (
                    <Fragment key={label}>
                      <span
                        className={cn(
                          "flex items-center justify-end pr-1 text-[10px] font-medium leading-none text-muted-foreground",
                          rowIndex % 2 === 0 && "invisible",
                        )}
                      >
                        {label}
                      </span>
                      {columns.map((week, weekIndex) => {
                        const cell = week[rowIndex]!;
                        const empty = !cell.day;
                        return (
                          <span
                            key={`${weekIndex}-${rowIndex}`}
                            title={
                              empty
                                ? undefined
                                : cell.active
                                  ? `${cell.day} · aktiv`
                                  : cell.day
                            }
                            className={cn(
                              "aspect-square w-full min-w-0 rounded-[2px] sm:rounded-[3px]",
                              empty
                                ? "bg-transparent"
                                : cell.active
                                  ? "bg-accent shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_35%,transparent)]"
                                  : "bg-muted/70 ring-1 ring-border/40",
                            )}
                            aria-hidden={empty}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              {summary.todayActive
                ? "Heute schon eingeloggt — Streak läuft."
                : "Melde dich heute an, um den Streak fortzusetzen."}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
