"use client";

import { useEffect, useState } from "react";
import { EmbedGwadaFooter } from "@/components/embed/embed-gwada-footer";
import { EmbedLocaleFlagPicker } from "@/components/embed/embed-locale-flag-picker";
import { EmbedLocaleProvider } from "@/components/embed/embed-locale-provider";
import type { AppLocale } from "@/i18n/config";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import { isExternalHostEmbed } from "@/lib/embed/is-external-host-embed";
import { applyAccentToDocument } from "@/lib/theme/color-utils";
import { cn } from "@/lib/utils";

export function EmbedAccentRoot({
  accentHex,
  textTheme = "dark",
  children,
  brandFooter = true,
  sourceLocale = "de",
  showLocalePicker = true,
}: {
  accentHex: string;
  /** Helle Schrift auf dunklem Host vs. dunkle Schrift auf hellem Host. */
  textTheme?: EmbedTextTheme;
  children: React.ReactNode;
  /** Gwada-Logo unter dem Widget (nicht bei gwada.js auf fremden Sites). */
  brandFooter?: boolean;
  /** Restaurant default language (content source + picker default). */
  sourceLocale?: AppLocale;
  showLocalePicker?: boolean;
}) {
  const [externalHostEmbed, setExternalHostEmbed] = useState(false);

  useEffect(() => {
    applyAccentToDocument(accentHex);
    setExternalHostEmbed(isExternalHostEmbed());
  }, [accentHex]);

  const showBrandFooter = brandFooter && !externalHostEmbed;

  return (
    <EmbedLocaleProvider sourceLocale={sourceLocale}>
      <div
        data-embed-text-theme={textTheme}
        className={cn(
          "min-h-0 w-full min-w-0 bg-transparent text-foreground antialiased",
        )}
      >
        <div className="flex w-full min-w-0 flex-col">
          {showLocalePicker ? (
            <div className="px-4 pt-3 sm:px-6">
              <EmbedLocaleFlagPicker />
            </div>
          ) : null}
          {children}
          {showBrandFooter ? <EmbedGwadaFooter /> : null}
        </div>
      </div>
    </EmbedLocaleProvider>
  );
}
