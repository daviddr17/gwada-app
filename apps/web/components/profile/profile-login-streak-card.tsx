"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

/** Feste Kachelgröße (GitHub-Contribution-Stil) — nicht mit Kartenbreite skalieren. */
const streakCellClassName =
  "size-2.5 shrink-0 rounded-[2px] sm:size-3 sm:rounded-[3px]";

const STREAK_STALE_MS = 5 * 60_000;

async function fetchLoginStreakSummary(): Promise<LoginStreakSummary> {
  const res = await fetch("/api/profile/login-streak");
  if (!res.ok) throw new Error("streak_load_failed");
  const json = (await res.json()) as { data?: LoginStreakSummary };
  if (!json.data) throw new Error("streak_empty");
  return json.data;
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

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-300">
            <Flame className="size-4" aria-hidden />
          </span>
          Login-Streak
        </CardTitle>
        <CardDescription>
          Tage, an denen du in Gwada aktiv warst.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-[82px] w-full max-w-xs rounded-xl" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : summary ? (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {summary.currentStreak}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    {summary.currentStreak === 1 ? "Tag" : "Tage"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">aktueller Streak</p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  Rekord{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {summary.longestStreak}
                  </span>
                </p>
                <p>
                  Gesamt{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {summary.totalDays}
                  </span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex w-max min-w-0 gap-2 sm:gap-3">
                <div className="flex shrink-0 flex-col gap-[3px] py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <span
                      key={label}
                      className={cn(
                        streakCellClassName,
                        "flex items-center justify-end pr-0.5 leading-none",
                        index % 2 === 0 && "invisible",
                      )}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="flex gap-[3px]">
                  {columns.map((week, weekIndex) => (
                    <div
                      key={weekIndex}
                      className="flex shrink-0 flex-col gap-[3px]"
                    >
                      {week.map((cell, dayIndex) => {
                        const empty = !cell.day;
                        return (
                          <span
                            key={`${weekIndex}-${dayIndex}`}
                            title={
                              empty
                                ? undefined
                                : cell.active
                                  ? `${cell.day} · aktiv`
                                  : cell.day
                            }
                            className={cn(
                              streakCellClassName,
                              empty
                                ? "bg-transparent"
                                : cell.active
                                  ? "bg-orange-500 shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-orange-500)_35%,transparent)]"
                                  : "bg-muted/70 ring-1 ring-border/40",
                            )}
                            aria-hidden={empty}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
