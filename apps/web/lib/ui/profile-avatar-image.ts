/**
 * Restaurant-Logo: runder Rahmen mit Innen-Padding + abgerundeter Kachel.
 * Eckige Logos mit Hintergrund bleiben in der Kachel, der Kreis clippt außen.
 */
export const restaurantLogoOuterFrameClassName =
  "relative inline-flex shrink-0 items-center justify-center aspect-square overflow-hidden rounded-full leading-none";

/** Padding-Ring sichtbar; Logo sitzt in der inneren Kachel */
export const restaurantLogoOuterPaddingClassName = "p-[13%]";

export const restaurantLogoInnerTileClassName =
  "flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[22%] bg-white p-1 dark:bg-card";

export const restaurantLogoImageClassName =
  "max-h-full max-w-full object-contain object-center";

export const restaurantLogoPlateClassName = "bg-card";

export const restaurantLogoFrameClassName =
  `${restaurantLogoOuterFrameClassName} border border-border bg-transparent`;

export const restaurantLogoHeaderFrameClassName =
  `${restaurantLogoOuterFrameClassName} shadow-card ring-4 ring-card`;

/** Personen-Avatar (rund) — Foto füllt den Kreis. */
export const profileAvatarImageClassName =
  "size-full object-cover object-center";

export const profileAvatarPlateClassName = "bg-card";

export const profileAvatarFallbackPlateClassName = "bg-muted";

export const profileAvatarRingFrameClassName =
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-transparent aspect-square leading-none";

export const profileAvatarHeaderFrameClassName =
  "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent shadow-card ring-4 ring-card";
