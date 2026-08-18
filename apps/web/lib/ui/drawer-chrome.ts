import { cn } from "@/lib/utils";

/** Gemeinsame Drawer-Shell (Abgerundung, Karte, Schatten). */
export const drawerChromeShellClassName =
  "mx-auto flex min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated";

/**
 * Standard-Breite der Bottom-Sheets.
 * Mobil bleibt viewport-breit (`w-full`); auf großen Screens 42rem statt 32rem (`max-w-lg`).
 */
export const drawerChromeMaxWidthClassName = "max-w-2xl";

/** Inhaltsschwere Sheets (Events, Galerie, Tagesliste). */
export const drawerChromeMaxWidthWideClassName = "max-w-3xl";

/**
 * Feste Shell-Höhen — müssen als vollständige Literal-Klassen stehen (Tailwind scannt
 * keine Template-Strings wie `h-[${maxHeight}]`).
 */
const drawerH720 = "h-[min(92dvh,720px)] max-h-[min(92dvh,720px)] min-h-0";
const drawerH760 = "h-[min(92dvh,760px)] max-h-[min(92dvh,760px)] min-h-0";
const drawerH640 = "h-[min(92dvh,640px)] max-h-[min(92dvh,640px)] min-h-0";
const drawerH560 = "h-[min(92dvh,560px)] max-h-[min(92dvh,560px)] min-h-0";
const drawerH560_88 = "h-[min(88dvh,560px)] max-h-[min(88dvh,560px)] min-h-0";
const drawerH520_88 = "h-[min(88dvh,520px)] max-h-[min(88dvh,520px)] min-h-0";
const drawerH420_88 = "h-[min(88dvh,420px)] max-h-[min(88dvh,420px)] min-h-0";
const drawerH560_85 = "h-[min(85dvh,560px)] max-h-[min(85dvh,560px)] min-h-0";
const drawerH480 = "h-[min(92dvh,480px)] max-h-[min(92dvh,480px)] min-h-0";
const drawerH480_88 = "h-[min(88dvh,480px)] max-h-[min(88dvh,480px)] min-h-0";
const drawerH520 = "h-[min(92dvh,520px)] max-h-[min(92dvh,520px)] min-h-0";
const drawerH640_90 = "h-[min(90dvh,640px)] max-h-[min(90dvh,640px)] min-h-0";
const drawerH520_85 = "h-[min(85dvh,520px)] max-h-[min(85dvh,520px)] min-h-0";
const drawerH92 = "h-[92dvh] max-h-[92dvh] min-h-0";
const drawerH90 = "h-[90dvh] max-h-[90dvh] min-h-0";

export const drawerChromeSizeClassNames = {
  /** Standard-Formular (Reservierung, Kontakt, Einstellungen …). */
  form: cn(drawerH720, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Mitarbeiter-Profil / Vertrag (etwas höher). */
  formStaff: cn(drawerH760, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Mittleres Formular (Schicht, Export Mitarbeiter …). */
  formMd: cn(drawerH640, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Filter-Bottom-Sheet. */
  filter: cn(drawerH560, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Protokoll / Übersicht (schmal). */
  overview: cn(drawerH560_88, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Info-Sheet (Kontakt-Reservierungen …). */
  info: cn(drawerH520_88, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Export / kurze Aktion. */
  export: cn(drawerH420_88, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Display Schicht-Gate / PIN-Checkliste — inhaltshoch, max. Höhe. */
  displayGate: cn(
    "h-auto max-h-[min(92dvh,640px)] min-h-0 overflow-hidden",
    drawerChromeMaxWidthClassName,
  ),
  /** Kompakte Statistik-Sheets. */
  compact: cn(drawerH560_85, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Breites Protokoll (Dokumente, Bewertungen). */
  wide: cn(drawerH560_88, "max-w-5xl overflow-hidden"),
  /** Nachrichten-Thread (breiter). */
  messages: cn(drawerH560_88, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Kontakt zuweisen. */
  assign: cn(drawerH480, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Bewertungseinladung. */
  invitation: cn(drawerH640_90, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Bestell-Export (Liste). */
  purchaseList: cn(drawerH520, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Schicht-Vorlage. */
  template: cn(drawerH560, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Zutaten-Verbrauch, kurzes Sheet. */
  usage: cn(drawerH480_88, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Speisekarte-Taxonomie. */
  taxonomy: cn(drawerH520, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Dokument-Formular. */
  documentForm: cn(drawerH720, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Buchführung Verkaufsbeleg. */
  salesDocument: cn(drawerH92, drawerChromeMaxWidthWideClassName, "overflow-hidden"),
  /** Bewertungs-Sheet. */
  reviewCompact: cn(drawerH520_85, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Medien / Story (minimal). */
  media: cn(drawerH90, drawerChromeMaxWidthClassName, "overflow-hidden"),
  /** Events / Galerie Compose. */
  mediaTall: cn(drawerH92, drawerChromeMaxWidthWideClassName, "overflow-hidden"),
  /** Reservierung bearbeiten — feste Höhe auf Mobile. */
  formFixed: cn(
    "h-[min(92dvh,720px)] max-h-[min(92dvh,720px)] min-h-0 max-w-[100dvw] overflow-hidden md:max-w-2xl",
  ),
  /** Tagesübersicht Reservierungen. */
  dayOverview: cn(
    "h-[min(96dvh,calc(100dvh-0.5rem))] max-h-[min(96dvh,calc(100dvh-0.5rem))] min-h-0 max-w-[100dvw] overflow-hidden md:max-w-3xl",
  ),
  /** Display-Reservierung: großes Sheet für Tablet (90 % Breite × Höhe). */
  displayForm:
    "h-[90dvh] max-h-[90dvh] min-h-0 w-[90dvw] max-w-[90dvw] overflow-hidden",
} as const;

export type DrawerChromeSize = keyof typeof drawerChromeSizeClassNames;

export function drawerContentClassName(
  size: DrawerChromeSize,
  className?: string,
): string {
  return cn(drawerChromeShellClassName, drawerChromeSizeClassNames[size], className);
}
