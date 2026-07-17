"use client";

import { useMemo } from "react";
import {
  formatDayHoursLabel,
  formatExceptionDateShortDe,
  groupUpcomingExceptionsByWeekday,
  openingHoursWeekdayRows,
} from "@/lib/opening-hours/embed-display-utils";
import type { PublicEmbedOpeningHoursSettings } from "@/lib/opening-hours/public-opening-hours-server";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";
import { cn } from "@/lib/utils";

export type PublicOpeningHoursDisplayProps = {
  weeklyHours: Record<Weekday, DayHours>;
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  settings: PublicEmbedOpeningHoursSettings;
  className?: string;
};

function OpeningHoursWeekdayExceptionLine({
  exception,
}: {
  exception: DateHoursException;
}) {
  const note = exception.note?.trim();
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
      <dt className="font-normal tabular-nums">
        {formatExceptionDateShortDe(exception.date)}
      </dt>
      <dd className="text-right tabular-nums">
        <span>{formatDayHoursLabel(exception)}</span>
        {note ? (
          <span className="text-muted-foreground/85">
            {" · "}
            <span data-embed-mt>{note}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/70"> · Sondertermin</span>
        )}
      </dd>
    </div>
  );
}

function OpeningHoursWeekdayBlock({
  label,
  value,
  exceptions,
}: {
  label: string;
  value: string;
  exceptions: DateHoursException[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <dt className="font-medium">{label}</dt>
        <dd className="tabular-nums text-muted-foreground">{value}</dd>
      </div>
      {exceptions.map((ex) => (
        <OpeningHoursWeekdayExceptionLine key={ex.date} exception={ex} />
      ))}
    </div>
  );
}

export function PublicOpeningHoursDisplay({
  weeklyHours,
  kitchenHoursEnabled,
  kitchenWeeklyHours,
  dateExceptions,
  settings,
  className,
}: PublicOpeningHoursDisplayProps) {
  const businessRows = useMemo(
    () => openingHoursWeekdayRows(weeklyHours),
    [weeklyHours],
  );
  const kitchenRows = useMemo(
    () => openingHoursWeekdayRows(kitchenWeeklyHours),
    [kitchenWeeklyHours],
  );
  const upcomingByWeekday = useMemo(
    () =>
      settings.embedShowExceptions
        ? groupUpcomingExceptionsByWeekday(dateExceptions)
        : {},
    [dateExceptions, settings.embedShowExceptions],
  );

  const showKitchen =
    settings.embedShowKitchenHours && kitchenHoursEnabled;

  const footerText = settings.embedFooterText?.trim() ?? "";

  return (
    <div className={cn("text-foreground", className)}>
      <section aria-labelledby="public-hours-business-heading">
        <h2
          id="public-hours-business-heading"
          className="mb-2 text-sm font-semibold"
        >
          Restaurant
        </h2>
        <dl className="space-y-1.5">
          {businessRows.map((row) => (
            <OpeningHoursWeekdayBlock
              key={row.day}
              label={row.label}
              value={row.value}
              exceptions={upcomingByWeekday[row.day] ?? []}
            />
          ))}
        </dl>
      </section>

      {showKitchen ? (
        <section
          className="mt-5 border-t border-border/50 pt-4"
          aria-labelledby="public-hours-kitchen-heading"
        >
          <h2
            id="public-hours-kitchen-heading"
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

      {footerText ? (
        <p
          className="mt-5 border-t border-border/50 pt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap"
          data-embed-mt
        >
          {footerText}
        </p>
      ) : null}
    </div>
  );
}
