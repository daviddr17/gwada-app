"use client";

import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Summary = {
  count: number;
  average: number | null;
  median: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export function ReviewSummaryCard({ summary }: { summary: Summary }) {
  const { count, average, median, distribution } = summary;
  const maxBar = Math.max(1, ...Object.values(distribution));

  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Durchschnitt
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight">
                {average != null ? average.toLocaleString("de-DE") : "—"}
              </span>
              <Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Median
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {median != null ? median.toLocaleString("de-DE") : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Anzahl
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{count}</p>
          </div>
        </div>
        <div className="space-y-2">
          {([5, 4, 3, 2, 1] as const).map((stars) => {
            const n = distribution[stars] ?? 0;
            const pct = Math.round((n / maxBar) * 100);
            return (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <span className="w-8 shrink-0 text-muted-foreground">{stars}★</span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full bg-accent/80")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-muted-foreground">{n}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
