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
            <Skeleton className="h-28 w-full rounded-xl" />
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
                  <span className="font-semibold tabular-nums text-foreground">
                    {summary.longestStreak}
                  </span>
                </p>
                <p>
                  Gesamt{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {summary.totalDays}
                  </span>
                </p>
              </div>
            </div>

            {columns.length > 0 ? (
              <div
                className="grid w-full gap-x-1 gap-y-1"
                style={{
                  gridTemplateColumns: `1.75rem repeat(${columns.length}, minmax(0, 1fr))`,
                }}
                role="img"
                aria-label="Aktivitäts-Heatmap der letzten Wochen"
              >
                {WEEKDAY_LABELS.map((label, rowIndex) => (
                  <Fragment key={label}>
                    <span
                      className={cn(
                        "flex items-center justify-end pr-1 text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground",
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
                            "aspect-square h-auto w-full min-w-0 rounded-[3px] sm:rounded-sm",
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
                  </Fragment>
                ))}
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
