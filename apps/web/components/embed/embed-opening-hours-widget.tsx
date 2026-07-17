"use client";

import { useMemo } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { PublicOpeningHoursDisplay } from "@/components/opening-hours/public-opening-hours-display";
import type { AppLocale } from "@/i18n/config";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import type { PublicEmbedOpeningHoursData } from "@/lib/opening-hours/public-opening-hours-server";

export type EmbedOpeningHoursWidgetProps = PublicEmbedOpeningHoursData & {
  textTheme?: EmbedTextTheme;
  sourceLocale?: AppLocale;
};

export function EmbedOpeningHoursWidget({
  accentHex,
  weeklyHours,
  kitchenHoursEnabled,
  kitchenWeeklyHours,
  dateExceptions,
  settings,
  textTheme = "dark",
  sourceLocale = "de",
}: EmbedOpeningHoursWidgetProps) {
  const footerText = settings.embedFooterText?.trim() ?? "";

  const resizeDeps = useMemo(
    () => [
      weeklyHours,
      kitchenWeeklyHours,
      dateExceptions,
      settings.embedShowExceptions,
      settings.embedShowKitchenHours,
      kitchenHoursEnabled,
      footerText,
      textTheme,
    ],
    [
      weeklyHours,
      kitchenWeeklyHours,
      dateExceptions,
      settings.embedShowExceptions,
      settings.embedShowKitchenHours,
      kitchenHoursEnabled,
      footerText,
      textTheme,
    ],
  );

  return (
    <EmbedAccentRoot
      accentHex={accentHex}
      textTheme={textTheme}
      sourceLocale={sourceLocale}
    >
      <div className="px-4 py-5 sm:px-6" data-gwada-embed-content>
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
