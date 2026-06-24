import { cn } from "@/lib/utils";

/** Gemeinsame Drawer-Shell (Abgerundung, Karte, Schatten). */
export const drawerChromeShellClassName =
  "mx-auto flex min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated";

/** Feste Shell-Höhe — flex-1-Scroll braucht h + max-h (h-auto lässt Inhalt zusammensacken). */
function drawerBoundedHeight(
  maxHeight: string,
  extra?: string,
): string {
  return cn(`h-[${maxHeight}] max-h-[${maxHeight}] min-h-0`, extra);
}

export const drawerChromeSizeClassNames = {
  /** Standard-Formular (Reservierung, Kontakt, Einstellungen …). */
  form: cn(drawerBoundedHeight("min(92dvh,720px)"), "max-w-lg overflow-hidden"),
  /** Mitarbeiter-Profil (etwas höher). */
  formStaff: cn(
    drawerBoundedHeight("min(92dvh,760px)"),
    "max-w-lg overflow-hidden",
  ),
  /** Mittleres Formular (Schicht, Export Mitarbeiter …). */
  formMd: cn(drawerBoundedHeight("min(92dvh,640px)"), "max-w-lg overflow-hidden"),
  /** Filter-Bottom-Sheet. */
  filter: cn(drawerBoundedHeight("min(92dvh,560px)"), "max-w-lg overflow-hidden"),
  /** Protokoll / Übersicht (schmal). */
  overview: cn(
    drawerBoundedHeight("min(88dvh,560px)"),
    "max-w-lg overflow-hidden",
  ),
  /** Info-Sheet (Kontakt-Reservierungen …). */
  info: cn(drawerBoundedHeight("min(88dvh,520px)"), "max-w-lg overflow-hidden"),
  /** Export / kurze Aktion. */
  export: cn(drawerBoundedHeight("min(88dvh,420px)"), "max-w-lg overflow-hidden"),
  /** Kompakte Statistik-Sheets. */
  compact: cn(drawerBoundedHeight("min(85dvh,560px)"), "max-w-lg overflow-hidden"),
  /** Breites Protokoll (Dokumente, Bewertungen). */
  wide: cn(drawerBoundedHeight("min(88dvh,560px)"), "max-w-5xl overflow-hidden"),
  /** Nachrichten-Thread (breiter). */
  messages: cn(
    drawerBoundedHeight("min(88dvh,560px)"),
    "max-w-2xl overflow-hidden",
  ),
  /** Kontakt zuweisen. */
  assign: cn(drawerBoundedHeight("min(92dvh,480px)"), "max-w-lg overflow-hidden"),
  /** Bewertungseinladung. */
  invitation: cn(
    drawerBoundedHeight("min(90dvh,640px)"),
    "max-w-lg overflow-hidden",
  ),
  /** Bestell-Export (Liste). */
  purchaseList: cn(
    drawerBoundedHeight("min(92dvh,520px)"),
    "max-w-lg overflow-hidden",
  ),
  /** Schicht-Vorlage. */
  template: cn(drawerBoundedHeight("min(92dvh,560px)"), "max-w-lg overflow-hidden"),
  /** Zutaten-Verbrauch, kurzes Sheet. */
  usage: cn(drawerBoundedHeight("min(88dvh,480px)"), "max-w-lg overflow-hidden"),
  /** Speisekarte-Taxonomie. */
  taxonomy: cn(drawerBoundedHeight("min(92dvh,520px)"), "max-w-lg overflow-hidden"),
  /** Dokument-Formular (Höhe flexibel). */
  documentForm: cn(
    drawerBoundedHeight("min(92dvh,720px)"),
    "max-w-lg overflow-hidden",
  ),
  /** Buchführung Verkaufsbeleg. */
  salesDocument: cn(drawerBoundedHeight("92dvh"), "max-w-3xl overflow-hidden"),
  /** Bewertungs-Sheet. */
  reviewCompact: cn(
    drawerBoundedHeight("min(85dvh,520px)"),
    "max-w-lg overflow-hidden",
  ),
  /** Medien / Story (minimal). */
  media: cn(drawerBoundedHeight("90dvh"), "max-w-lg overflow-hidden"),
  /** Events / Galerie Compose (ohne festes Pixel-Limit). */
  mediaTall: cn(drawerBoundedHeight("92dvh"), "max-w-lg overflow-hidden"),
  /** Reservierung bearbeiten — feste Höhe auf Mobile. */
  formFixed:
    "h-[min(92dvh,720px)] max-h-[min(92dvh,720px)] min-h-0 max-w-[100dvw] overflow-hidden md:max-w-lg",
  /** Tagesübersicht Reservierungen. */
  dayOverview:
    "h-[min(96dvh,calc(100dvh-0.5rem))] max-h-[min(96dvh,calc(100dvh-0.5rem))] min-h-0 max-w-[100dvw] overflow-hidden md:max-w-[42rem]",
} as const;

export type DrawerChromeSize = keyof typeof drawerChromeSizeClassNames;

export function drawerContentClassName(
  size: DrawerChromeSize,
  className?: string,
): string {
  return cn(drawerChromeShellClassName, drawerChromeSizeClassNames[size], className);
}
