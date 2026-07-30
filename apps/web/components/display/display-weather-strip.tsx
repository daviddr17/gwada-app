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

  const hasDayRange =
    snapshot.tempMin !== null &&
    snapshot.tempMax !== null &&
    !Number.isNaN(snapshot.tempMin) &&
    !Number.isNaN(snapshot.tempMax);

  const ariaParts = [
    `Aktuell ${formatTemp(snapshot.temp)}`,
    hasDayRange
      ? `Hoch ${formatTemp(snapshot.tempMax)} Tief ${formatTemp(snapshot.tempMin)}`
      : null,
    `Regen ${formatPercent(snapshot.precipProb)}`,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
      aria-label={`Wetter am Standort: ${ariaParts.join(", ")}`}
    >
      <CloudSun className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="shrink-0 tabular-nums font-medium text-foreground">
        {formatTemp(snapshot.temp)}
      </span>
      {hasDayRange ? (
        <>
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <span className="shrink-0 tabular-nums">
            <span className="font-medium text-foreground/70">Hoch</span>{" "}
            {formatTemp(snapshot.tempMax)}
          </span>
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <span className="shrink-0 tabular-nums">
            <span className="font-medium text-foreground/70">Tief</span>{" "}
            {formatTemp(snapshot.tempMin)}
          </span>
        </>
      ) : null}
      <span className="text-border/80" aria-hidden>
        ·
      </span>
      <span className="shrink-0 tabular-nums">
        <span className="font-medium text-foreground/70">Regen</span>{" "}
        {formatPercent(snapshot.precipProb)}
      </span>
    </div>
  );
}
