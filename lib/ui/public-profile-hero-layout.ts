import { cn } from "@/lib/utils";

/** Volle Hero-Section — scrollt bei kurzer Viewport-Höhe (Dock bleibt fix). */
export const publicProfileHeroSectionClassName =
  "relative z-[2] flex min-h-0 flex-1 flex-col justify-start overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-14";

/** Breiten- / Padding-Stage — bei genug Höhe vertikal zentriert, sonst scrollbar. */
export const publicProfileHeroStageClassName =
  "relative z-[2] mx-auto flex w-full min-h-full max-w-lg flex-col items-center justify-center px-4 sm:max-w-xl sm:px-6 md:max-w-2xl lg:max-w-3xl";

export const publicProfileHeroTitleClassName =
  "text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl";

export const publicProfileHeroDescriptionClassName =
  "mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground md:text-base";

/** Sichtbare Hero-Karte — Cover + Body-Chrome. */
export const publicProfileHeroCardShellClassName = cn(
  "relative w-full overflow-hidden rounded-[2rem]",
  "border border-neutral-200/70 bg-white/80",
  "shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-2xl",
  "dark:border-white/10 dark:bg-black/25 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)]",
  "md:rounded-[2.25rem] lg:rounded-[2.5rem]",
);

/** Skeleton-Karte — ohne weißen Body-Hintergrund, Hero scheint durch. */
export const publicProfileHeroCardSkeletonShellClassName = cn(
  "relative w-full overflow-hidden rounded-[2rem]",
  "border-0 bg-transparent shadow-none",
  "md:rounded-[2.25rem] lg:rounded-[2.5rem]",
);

export const publicProfileHeroCoverClassName =
  "relative h-36 overflow-hidden sm:h-40 md:h-48 lg:h-52";

export const publicProfileHeroBodyClassName =
  "relative px-6 pb-6 pt-0 md:px-10 md:pb-8 lg:px-12 lg:pb-10";

export const publicProfileHeroLogoRowClassName =
  "-mt-12 flex justify-center overflow-visible sm:-mt-14 md:-mt-16";

export const publicProfileHeroTitleBlockClassName =
  "mt-4 text-center md:mt-5";

/** Fallback, wenn kein Profil für datengetreuen Skeleton übergeben wird. */
export const publicProfileHeroBodyFallbackMinClassName =
  "min-h-[11.5rem] md:min-h-[12rem]";

export const publicProfileHeroStatusBlockClassName = "mt-4 flex justify-center";

export const publicProfileHeroDetailsBlockClassName =
  "mt-5 space-y-2 text-sm empty:hidden";

export const publicProfileHeroSocialBlockClassName =
  "mt-5 flex flex-wrap justify-center gap-2 empty:hidden";
