"use client";

import { useMemo } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { PublicOpeningHoursDisplay } from "@/components/opening-hours/public-opening-hours-display";
import {
  openingHoursWeekdayRows,
  upcomingOpeningExceptions,
} from "@/lib/opening-hours/embed-display-utils";
import type { PublicEmbedOpeningHoursData } from "@/lib/opening-hours/public-opening-hours-server";

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

        <PublicOpeningHoursDisplay
          weeklyHours={weeklyHours}
          kitchenHoursEnabled={kitchenHoursEnabled}
          kitchenWeeklyHours={kitchenWeeklyHours}
          dateExceptions={dateExceptions}
          settings={settings}
        />
      </div>
      <EmbedResizeReporter deps={resizeDeps} widget="opening_hours" />
    </EmbedAccentRoot>
  );
}
