"use client";

import { CloudSun } from "lucide-react";
import { useDisplayWeatherSummary } from "@/lib/hooks/use-display-weather-summary";
import { cn } from "@/lib/utils";

const tempFmt = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatTemp(c: number | null): string {
  if (c === null || Number.isNaN(c)) return "—";
  return `${tempFmt.format(c)} °C`;
}

function formatPercent(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${tempFmt.format(v)} %`;
}

export function DisplayWeatherStrip({
  enabled = true,
  restaurantId,
  className,
}: {
  enabled?: boolean;
  /** Optional — beschleunigt Cache-Treffer nach Login/Logout. */
  restaurantId?: string | null;
  className?: string;
}) {
  const { snapshot, available, loading } = useDisplayWeatherSummary(
    enabled,
    restaurantId,
  );

  if (!enabled) {
    return null;
  }

  if (!snapshot) {
    if (!loading) return null;
    return (
      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
        aria-busy
        aria-label="Wetter wird geladen"
      >
        <CloudSun className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span>Wetter …</span>
      </div>
    );
  }

  if (!available) {
    return null;
  }

  const range =
    snapshot.tempMin !== null && snapshot.tempMax !== null
      ? `${formatTemp(snapshot.tempMin)} – ${formatTemp(snapshot.tempMax)}`
      : null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
      aria-label="Wetter am Standort"
    >
      <CloudSun className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="shrink-0 tabular-nums font-medium text-foreground">
        {formatTemp(snapshot.temp)}
      </span>
      {range ? (
        <>
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <span className="hidden min-w-0 truncate tabular-nums md:inline">
            {range}
          </span>
        </>
      ) : null}
      <span className="text-border/80" aria-hidden>
        ·
      </span>
      <span className="shrink-0 tabular-nums">
        Regen {formatPercent(snapshot.precipProb)}
      </span>
    </div>
  );
}
