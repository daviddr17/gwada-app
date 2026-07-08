"use client";

import type { ReactNode } from "react";
import { DisplayPwaInstallButton } from "@/components/display/display-pwa-install-button";
import { DisplayWeatherStrip } from "@/components/display/display-weather-strip";
import { ModeToggle } from "@/components/theme/mode-toggle";
import {
  displayChromeHeaderClassName,
  displayChromeModeToggleClassName,
} from "@/lib/ui/display-chrome";
import { cn } from "@/lib/utils";

/** Kompakte Display-Kopfzeile — Theme-Umschalter immer rechts in der Zeile. */
export function DisplayChromeHeader({
  children,
  trailing,
  restaurantId,
  weatherEnabled = true,
  className,
}: {
  children?: ReactNode;
  trailing?: ReactNode;
  /** Optional — Cache-Hinweis; API nutzt Display-Geräte-Cookie. */
  restaurantId?: string | null;
  /** Wetter in der Kopfzeile (gepairtes Tablet). */
  weatherEnabled?: boolean;
  className?: string;
}) {
  return (
    <header className={cn(displayChromeHeaderClassName, className)}>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        <DisplayWeatherStrip
          enabled={weatherEnabled}
          restaurantId={restaurantId}
        />
        {trailing}
        <DisplayPwaInstallButton />
        <ModeToggle className={displayChromeModeToggleClassName} />
      </div>
    </header>
  );
}
