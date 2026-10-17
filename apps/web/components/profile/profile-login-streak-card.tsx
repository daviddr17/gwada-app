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
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-14 w-48 rounded-lg" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : summary ? (
          <>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <div>
                <p className="text-xl font-semibold tabular-nums tracking-tight">
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
              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-[2px]"
                  style={{
                    gridTemplateColumns: `1.25rem repeat(${columns.length}, 0.5rem)`,
                  }}
                  role="img"
                  aria-label="Aktivitäts-Heatmap der letzten Wochen"
                >
                  {WEEKDAY_LABELS.map((label, rowIndex) => (
                    <Fragment key={label}>
                      <span
                        className={cn(
                          "flex h-2 items-center justify-end pr-0.5 text-[9px] font-medium leading-none text-muted-foreground",
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
                              "size-2 rounded-[2px]",
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
