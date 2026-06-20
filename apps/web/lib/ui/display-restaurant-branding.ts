import { cn } from "@/lib/utils";

/** Harte Obergrenze — mobil ≤100px, Desktop ≤200px (verhindert aufgeblähte Bilder). */
export const displayRestaurantLogoMaxClassName =
  "max-h-[100px] max-w-[100px] sm:max-h-[200px] sm:max-w-[200px]";

const displayRestaurantLogoFrameClassName =
  "shrink-0 overflow-hidden border border-border/60 shadow-sm ring-1 ring-card";

/** Modulauswahl / Hero — klein, Funktion im Vordergrund. */
export const displayRestaurantLogoClassName = cn(
  "size-8 sm:size-10",
  displayRestaurantLogoMaxClassName,
  displayRestaurantLogoFrameClassName,
);

/** PIN-Screen — noch kompakter. */
export const displayRestaurantLogoCompactClassName = cn(
  "size-7 sm:size-8",
  displayRestaurantLogoMaxClassName,
  displayRestaurantLogoFrameClassName,
);

export const displayRestaurantHeroTitleClassName =
  "text-base font-semibold leading-tight tracking-tight sm:text-lg";

export const displayRestaurantHeroCompactTitleClassName =
  "truncate text-sm font-medium sm:text-base";
