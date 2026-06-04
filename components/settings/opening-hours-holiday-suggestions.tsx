"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayDateString } from "@/lib/restaurant/date-exception-utils";
import { publicHolidayChipClassName } from "@/lib/ui/public-holiday-chip";
type HolidaySuggestion = {
  date: string;
  name: string;
};

function formatSuggestionDate(ymd: string): string {
  try {
    return new Date(`${ymd}T12:00:00`).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return ymd;
  }
}

export function OpeningHoursHolidaySuggestions({
  restaurantId,
  countryLabel,
  existingDates,
  onAddException,
}: {
  restaurantId: string | null;
  countryLabel: string;
  existingDates: Set<string>;
  onAddException: (date: string, name: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<HolidaySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const today = todayDateString();
  const endYmd = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 31);
    return d.toISOString().slice(0, 10);
  }, [today]);

  useEffect(() => {
    if (!restaurantId) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    const params = new URLSearchParams({
      restaurantId,
      from: today,
      to: endYmd,
    });

    fetch(`/api/holidays/range?${params}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          holidays?: HolidaySuggestion[];
        };
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data.holidays)) {
          setLoadError(true);
          setSuggestions([]);
          return;
        }
        setSuggestions(data.holidays);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId, today, endYmd]);

  const visible = useMemo(
    () => suggestions.filter((h) => !existingDates.has(h.date)),
    [suggestions, existingDates],
  );

  if (!restaurantId) return null;

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border/50 bg-muted/10 px-3 py-3">
      <p className="text-xs text-muted-foreground">
        Feiertags-Vorschläge für{" "}
        <span className="font-medium text-foreground">
          {countryLabel.trim() || "Deutschland"}
        </span>{" "}
        (nächste 31 Tage) — als Ausnahme übernehmen.
      </p>
      {loading ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-7 w-40 rounded-full" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-muted-foreground">
          Feiertage konnten nicht geladen werden.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Keine weiteren Feiertage in den nächsten 31 Tagen — oder bereits als
          Ausnahme hinterlegt.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((h) => (
            <Button
              key={h.date}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto gap-1.5 rounded-full py-1 pr-2 pl-2"
              onClick={() => onAddException(h.date, h.name)}
            >
              <Badge
                variant="outline"
                className={publicHolidayChipClassName}
              >
                {formatSuggestionDate(h.date)}
              </Badge>
              <span className="max-w-[12rem] truncate text-xs">{h.name}</span>
              <Plus className="size-3.5 shrink-0 opacity-70" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
