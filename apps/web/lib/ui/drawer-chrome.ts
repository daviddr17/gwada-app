import { cn } from "@/lib/utils";

/** Gemeinsame Drawer-Shell (Abgerundung, Karte, Schatten). */
export const drawerChromeShellClassName =
  "mx-auto flex min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated";

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
  form: cn(drawerH720, "max-w-lg overflow-hidden"),
  /** Mitarbeiter-Profil / Vertrag (etwas höher). */
  formStaff: cn(drawerH760, "max-w-lg overflow-hidden"),
  /** Mittleres Formular (Schicht, Export Mitarbeiter …). */
  formMd: cn(drawerH640, "max-w-lg overflow-hidden"),
  /** Filter-Bottom-Sheet. */
  filter: cn(drawerH560, "max-w-lg overflow-hidden"),
  /** Protokoll / Übersicht (schmal). */
  overview: cn(drawerH560_88, "max-w-lg overflow-hidden"),
  /** Info-Sheet (Kontakt-Reservierungen …). */
  info: cn(drawerH520_88, "max-w-lg overflow-hidden"),
  /** Export / kurze Aktion. */
  export: cn(drawerH420_88, "max-w-lg overflow-hidden"),
  /** Kompakte Statistik-Sheets. */
  compact: cn(drawerH560_85, "max-w-lg overflow-hidden"),
  /** Breites Protokoll (Dokumente, Bewertungen). */
  wide: cn(drawerH560_88, "max-w-5xl overflow-hidden"),
  /** Nachrichten-Thread (breiter). */
  messages: cn(drawerH560_88, "max-w-2xl overflow-hidden"),
  /** Kontakt zuweisen. */
  assign: cn(drawerH480, "max-w-lg overflow-hidden"),
  /** Bewertungseinladung. */
  invitation: cn(drawerH640_90, "max-w-lg overflow-hidden"),
  /** Bestell-Export (Liste). */
  purchaseList: cn(drawerH520, "max-w-lg overflow-hidden"),
  /** Schicht-Vorlage. */
  template: cn(drawerH560, "max-w-lg overflow-hidden"),
  /** Zutaten-Verbrauch, kurzes Sheet. */
  usage: cn(drawerH480_88, "max-w-lg overflow-hidden"),
  /** Speisekarte-Taxonomie. */
  taxonomy: cn(drawerH520, "max-w-lg overflow-hidden"),
  /** Dokument-Formular. */
  documentForm: cn(drawerH720, "max-w-lg overflow-hidden"),
  /** Buchführung Verkaufsbeleg. */
  salesDocument: cn(drawerH92, "max-w-3xl overflow-hidden"),
  /** Bewertungs-Sheet. */
  reviewCompact: cn(drawerH520_85, "max-w-lg overflow-hidden"),
  /** Medien / Story (minimal). */
  media: cn(drawerH90, "max-w-lg overflow-hidden"),
  /** Events / Galerie Compose. */
  mediaTall: cn(drawerH92, "max-w-lg overflow-hidden"),
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
