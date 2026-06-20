import { cn } from "@/lib/utils";

/** Gemeinsame Drawer-Shell (Abgerundung, Karte, Schatten). */
export const drawerChromeShellClassName =
  "mx-auto flex w-full flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated";

export const drawerChromeSizeClassNames = {
  /** Standard-Formular (Reservierung, Kontakt, Einstellungen …). */
  form: "max-h-[min(92dvh,720px)] max-w-lg overflow-hidden",
  /** Mitarbeiter-Profil (etwas höher). */
  formStaff: "max-h-[min(92dvh,760px)] max-w-lg overflow-hidden",
  /** Mittleres Formular (Schicht, Export Mitarbeiter …). */
  formMd: "max-h-[min(92dvh,640px)] max-w-lg overflow-hidden",
  /** Filter-Bottom-Sheet. */
  filter: "max-h-[min(92dvh,560px)] max-w-lg overflow-hidden",
  /** Protokoll / Übersicht (schmal). */
  overview: "max-h-[min(88dvh,560px)] max-w-lg",
  /** Info-Sheet (Kontakt-Reservierungen …). */
  info: "max-h-[min(88dvh,520px)] max-w-lg",
  /** Export / kurze Aktion. */
  export: "max-h-[min(88dvh,420px)] max-w-lg",
  /** Kompakte Statistik-Sheets. */
  compact: "max-h-[min(85dvh,560px)] max-w-lg",
  /** Breites Protokoll (Dokumente, Bewertungen). */
  wide: "max-h-[min(88dvh,560px)] max-w-5xl",
  /** Nachrichten-Thread (breiter). */
  messages: "max-h-[min(88dvh,560px)] max-w-2xl",
  /** Kontakt zuweisen. */
  assign: "max-h-[min(92dvh,480px)] max-w-lg",
  /** Bewertungseinladung. */
  invitation: "max-h-[min(90dvh,640px)] max-w-lg",
  /** Bestell-Export (Liste). */
  purchaseList: "max-h-[min(92dvh,520px)] max-w-lg overflow-hidden",
  /** Schicht-Vorlage. */
  template: "max-h-[min(92dvh,560px)] max-w-lg",
  /** Zutaten-Verbrauch, kurzes Sheet. */
  usage: "max-h-[min(88dvh,480px)] max-w-lg",
  /** Speisekarte-Taxonomie. */
  taxonomy: "max-h-[min(92dvh,520px)] max-w-lg",
  /** Dokument-Formular (Höhe flexibel). */
  documentForm: "max-w-lg overflow-hidden",
  /** Buchführung Verkaufsbeleg. */
  salesDocument: "max-h-[92dvh] max-w-3xl overflow-hidden",
  /** Bewertungs-Sheet. */
  reviewCompact: "max-h-[min(85dvh,520px)] max-w-lg",
  /** Medien / Story (minimal). */
  media: "max-h-[90dvh] max-w-lg",
  /** Events / Galerie Compose (ohne festes Pixel-Limit). */
  mediaTall: "max-h-[92dvh] max-w-lg",
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
