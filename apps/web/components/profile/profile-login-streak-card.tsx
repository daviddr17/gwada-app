"use client";

import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

export function ProfileLoginStreakCard() {
  const [summary, setSummary] = useState<LoginStreakSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/profile/login-streak");
        if (!res.ok) {
          if (!cancelled) setError("Streak konnte nicht geladen werden.");
          return;
        }
        const json = (await res.json()) as { data?: LoginStreakSummary };
        if (!cancelled) setSummary(json.data ?? null);
      } catch {
        if (!cancelled) setError("Streak konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : summary ? (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
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

            <div className="flex w-full gap-2 sm:gap-3">
              <div className="flex shrink-0 flex-col justify-between py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_LABELS.map((label, index) =>
                  index % 2 === 1 ? (
                    <span key={label} className="leading-none">
                      {label}
                    </span>
                  ) : (
                    <span key={label} className="invisible leading-none">
                      {label}
                    </span>
                  ),
                )}
              </div>
              <div
                className="grid min-w-0 flex-1 gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
                }}
              >
                {columns.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex min-w-0 flex-col gap-[3px]">
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
                            "aspect-square w-full rounded-[2px] sm:rounded-[3px]",
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
