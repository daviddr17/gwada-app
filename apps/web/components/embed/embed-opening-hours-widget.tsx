"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { Badge } from "@/components/ui/badge";
import {
  formatDayHoursLabel,
  formatExceptionDateDe,
  openingHoursWeekdayRows,
  upcomingOpeningExceptions,
} from "@/lib/opening-hours/embed-display-utils";
import type { PublicEmbedOpeningHoursData } from "@/lib/opening-hours/public-opening-hours-server";
import { cn } from "@/lib/utils";

export type EmbedOpeningHoursWidgetProps = PublicEmbedOpeningHoursData;

export function EmbedOpeningHoursWidget({
  restaurantName,
  accentHex,
  weeklyHours,
  kitchenHoursEnabled,
  kitchenWeeklyHours,
  dateExceptions,
  settings,
}: EmbedOpeningHoursWidgetProps) {
  const businessRows = useMemo(
    () => openingHoursWeekdayRows(weeklyHours),
    [weeklyHours],
  );
  const kitchenRows = useMemo(
    () => openingHoursWeekdayRows(kitchenWeeklyHours),
    [kitchenWeeklyHours],
  );
  const upcoming = useMemo(
    () =>
      settings.embedShowExceptions
        ? upcomingOpeningExceptions(dateExceptions)
        : [],
    [dateExceptions, settings.embedShowExceptions],
  );

  const showKitchen =
    settings.embedShowKitchenHours && kitchenHoursEnabled;

  const footerText = settings.embedFooterText?.trim() ?? "";

  const resizeDeps = useMemo(
    () => [
      restaurantName,
      businessRows,
      kitchenRows,
      upcoming,
      showKitchen,
      footerText,
    ],
    [restaurantName, businessRows, kitchenRows, upcoming, showKitchen, footerText],
  );

  return (
    <EmbedAccentRoot accentHex={accentHex}>
      <div className="bg-background px-4 py-5 text-foreground sm:px-6">
        <header className="mb-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Öffnungszeiten
          </p>
          <h1 className="text-lg font-semibold tracking-tight">{restaurantName}</h1>
        </header>

        <section aria-labelledby="embed-hours-business-heading">
          <h2
            id="embed-hours-business-heading"
            className="mb-2 text-sm font-semibold"
          >
            Restaurant
          </h2>
          <dl className="space-y-1.5">
            {businessRows.map((row) => (
              <div
                key={row.day}
                className="flex items-baseline justify-between gap-4 text-sm"
              >
                <dt className="font-medium">{row.label}</dt>
                <dd className="tabular-nums text-muted-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {showKitchen ? (
          <section
            className="mt-5 border-t border-border/50 pt-4"
            aria-labelledby="embed-hours-kitchen-heading"
          >
            <h2
              id="embed-hours-kitchen-heading"
              className="mb-2 text-sm font-semibold"
            >
              Küche
            </h2>
            <dl className="space-y-1.5">
              {kitchenRows.map((row) => (
                <div
                  key={row.day}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <dt className="font-medium">{row.label}</dt>
                  <dd className="tabular-nums text-muted-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {upcoming.length > 0 ? (
          <section
            className="mt-5 border-t border-border/50 pt-4"
            aria-labelledby="embed-hours-exceptions-heading"
          >
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
              <h2
                id="embed-hours-exceptions-heading"
                className="text-sm font-semibold"
              >
                Sondertermine
              </h2>
            </div>
            <ul className="space-y-2">
              {upcoming.map((ex) => (
                <li
                  key={ex.date}
                  className={cn(
                    "rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-sm",
                    "ring-1 ring-accent/15",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatExceptionDateDe(ex.date)}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-accent/30 bg-accent/10 font-normal text-foreground"
                    >
                      {ex.closed ? "Ausnahme" : "Sonderöffnung"}
                    </Badge>
                  </div>
                  <p className="mt-1 tabular-nums text-muted-foreground">
                    {formatDayHoursLabel(ex)}
                  </p>
                  {ex.note?.trim() ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ex.note.trim()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {footerText ? (
          <p className="mt-5 border-t border-border/50 pt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {footerText}
          </p>
        ) : null}
      </div>
      <EmbedResizeReporter deps={resizeDeps} widget="opening_hours" />
    </EmbedAccentRoot>
  );
}
