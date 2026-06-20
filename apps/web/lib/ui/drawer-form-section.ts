import { cn } from "@/lib/utils";

/** Horizontal padding im Scroll-Bereich vieler Bottom Sheets (4 = Buchführung, 5 = Mitarbeiter, 6 = Standard). */
export type DrawerContentPadding = 4 | 5 | 6 | "4-6";

/** Volle Breite: negativer Rand gleicht Scroll-Padding aus. */
export function drawerFormSectionBleedClassName(
  contentPadding: DrawerContentPadding = 6,
): string {
  switch (contentPadding) {
    case 4:
      return "-mx-4 px-4";
    case 5:
      return "-mx-5 px-5";
    case "4-6":
      return "-mx-4 px-4 md:-mx-6 md:px-6";
    default:
      return "-mx-6 px-6";
  }
}

/** Auf lg bei zweispaltigem Sheet: kein Überstand in die Nachbarspalte. */
export const drawerFormSectionColumnBleedResetClassName =
  "lg:mx-0 lg:px-0";

export type DrawerFormSectionBleed = boolean | "column";

export function drawerFormSectionBleedClasses(
  contentPadding: DrawerContentPadding = 6,
  bleed: DrawerFormSectionBleed = true,
): string | undefined {
  if (bleed === false) return undefined;
  const base = drawerFormSectionBleedClassName(contentPadding);
  if (bleed === "column") {
    return cn(base, drawerFormSectionColumnBleedResetClassName);
  }
  return base;
}

/** Leichte Vollbreite-Tönung — wie Profil-Kopf im Mitarbeiter-Sheet. */
export const drawerFormSectionTintClassName =
  "border-t border-border/50 bg-muted/20 py-4 first:border-t-0";

export const drawerFormSectionTitleClassName =
  "text-xs font-medium tracking-wide text-muted-foreground uppercase";

export const drawerFormSectionBodyClassName = "space-y-3";

export function drawerFormSectionClassName(
  contentPadding: DrawerContentPadding = 6,
  className?: string,
  bleed: DrawerFormSectionBleed = true,
): string {
  return cn(
    drawerFormSectionTintClassName,
    drawerFormSectionBleedClasses(contentPadding, bleed),
    drawerFormSectionBodyClassName,
    className,
  );
}

/** Horizontales Padding — gleicher Wert wie Scroll/Footer. */
export function drawerHorizontalPaddingClassName(
  contentPadding: DrawerContentPadding = 6,
): string {
  switch (contentPadding) {
    case 4:
      return "px-4";
    case 5:
      return "px-5";
    case "4-6":
      return "px-4 md:px-6";
    default:
      return "px-6";
  }
}

/** Scroll-Inset: unten mindestens so viel Abstand wie seitlich (vor sticky Footer). */
export function drawerScrollPaddingClassName(
  contentPadding: DrawerContentPadding = 6,
): string {
  switch (contentPadding) {
    case 4:
      return "px-4 pb-4";
    case 5:
      return "px-5 pb-5";
    case "4-6":
      return "px-4 pb-4 md:px-6 md:pb-6";
    default:
      return "px-6 pb-6";
  }
}

/** Scroll-Container für Formular-Bottom-Sheets. */
export function drawerScrollAreaClassName(
  contentPadding: DrawerContentPadding = 6,
  className?: string,
): string {
  return cn(
    "min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain",
    drawerScrollPaddingClassName(contentPadding),
    className,
  );
}

/** Kopfzeile — seitliches Padding wie Scroll/Footer, oben/unten symmetrisch. */
export function drawerFormHeaderClassName(
  contentPadding: DrawerContentPadding = 6,
  className?: string,
): string {
  return cn(
    "shrink-0 text-left pt-4 pb-4",
    drawerHorizontalPaddingClassName(contentPadding),
    className,
  );
}

/** Text-/Select-Felder in Formular-Bottom-Sheets. */
export const drawerFormFieldClassName =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

/** Volle Breite für sekundäre Aktionen im Scroll-Bereich (Schließen, Link-Button). */
export const drawerFormFullWidthButtonClassName = "h-11 w-full rounded-xl";
