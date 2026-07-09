import { appChromeFixedZoneBgClassName } from "@/lib/ui/app-chrome-fixed-zone";
import { cn } from "@/lib/utils";

/** Tabellenkopf-Labels — etwas größer, höherer Kontrast in Light und Dark. */
export const moduleDataTableHeadLabelClassName =
  "text-sm font-medium text-secondary-foreground";

/** Sortierbare Köpfe mit Uppercase (Bestand, Buchhaltung, …). */
export const moduleDataTableHeadLabelSortableClassName =
  `${moduleDataTableHeadLabelClassName} uppercase tracking-wide`;

const moduleDataTableHeadBaseClassName = `${appChromeFixedZoneBgClassName} border-b border-border/60 text-left ${moduleDataTableHeadLabelClassName}`;

/** Hülle um paginierte Modul-Tabellen — kein Card-Padding, kein Rand, thead bündig oben. */
export const moduleDataTableShellClassName =
  "overflow-hidden rounded-xl bg-card ring-0 shadow-none";

/** Vollbild-Overlay: volle Breite, sticky Spaltenkopf im Scroll-Bereich. */
export const moduleDataTableFullscreenShellClassName = cn(
  "w-full overflow-visible rounded-none bg-card ring-0 shadow-none",
  "[&_table]:border-separate [&_table]:border-spacing-0",
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10",
  "[&_thead_th]:border-b [&_thead_th]:border-border/60",
  "[&_thead_th]:!bg-[var(--app-chrome-fixed-zone)]",
);

/** Keine Trennlinie zwischen Pagination und Tabellenkopf — bündig mit Tabellenrand (ohne px). */
export const moduleListPaginationAboveClassName = "border-b-0 pb-3";
export const moduleListPaginationBelowClassName = "border-t-0 pt-3";

/** Vollbild-Overlay: seitlicher Einzug wie Tabellenzellen (Standard px-4, Bestand/Kontakte px-2). */
export const moduleTableFullscreenChromeInsetClassName = "px-4";
export const moduleTableFullscreenChromeInsetDenseClassName = "px-2";

/** Einheitliche Aktionen-Spalte (rechts, mehrere Icon-Buttons). */
export const moduleDataTableActionsColumnClassName =
  "w-[9.25rem] min-w-[9.25rem] shrink-0 px-2";

export const moduleDataTableActionsCellClassName = cn(
  moduleDataTableActionsColumnClassName,
  "py-3",
);

/**
 * Opaker Zeilen-Hover für sticky Identitätsspalten —
 * entspricht visuell `hover:bg-muted/N` auf `bg-card`, ohne Durchscheinen.
 */
export const moduleTableStickyIdentityHover20ClassName =
  "group-hover/tr:bg-[color-mix(in_oklch,var(--muted)_20%,var(--card))]";

export const moduleTableStickyIdentityHover60ClassName =
  "group-hover/tr:bg-[color-mix(in_oklch,var(--muted)_60%,var(--card))]";

/** Undurchsichtiger Grundton der sticky Identitätsspalte (Tabellen-Card-Hintergrund). */
export const moduleTableStickyIdentityBgClassName = "bg-card";

/**
 * Undurchsichtiger Kopf-Hintergrund für sticky Identitätsspalten —
 * entspricht thead (`bg-app-chrome-fixed-zone`), explizit auf th (tr-BG reicht bei sticky nicht).
 */
export const moduleTableStickyIdentityHeadBgClassName =
  "!bg-[var(--app-chrome-fixed-zone)]";

/** Tabellenkopf — gleiche Fläche wie Sidebar-Kopf/-Fuß und App-Header. */
export const moduleDataTableHeadRowClassName = moduleDataTableHeadBaseClassName;

/** Tabellenkopf ohne Uppercase (Bestellungen, Display-Bestellliste, …). */
export const moduleDataTableHeadRowNormalCaseClassName = cn(
  moduleDataTableHeadBaseClassName,
  "normal-case [&_button]:normal-case [&_span]:normal-case",
);

export const moduleDataTableHeadCellClassName = "px-4 py-3 text-left";

/** Kompakter Kopf (Bestand — enge Tabellen). */
export const moduleDataTableHeadCellDenseClassName = "px-2 py-2 text-left";

/** Sortier-Tabellen (Bestand, …): zusätzlich uppercase. */
export const moduleDataTableHeadRowSortableClassName = `${moduleDataTableHeadBaseClassName} uppercase tracking-wide`;

/** Protokoll-/Drawer-Tabellen mit muted-Hintergrund (ohne Chrome-Zone). */
export const moduleDataTableHeadRowMutedClassName = `border-b border-border/60 bg-muted/40 text-left ${moduleDataTableHeadLabelSortableClassName}`;

/** Kompakter Kopf (Protokoll-Drawer, enge Tabellen). */
export const moduleDataTableHeadCellCompactClassName = "px-3 py-2.5 text-left";

export const moduleDataTableHeadRowCompactClassName = `${moduleDataTableHeadBaseClassName} uppercase tracking-wide`;

/** Protokoll-Drawer: Tabelle ohne Außenrand. */
export const moduleDataTableDrawerShellClassName =
  "overflow-hidden rounded-lg bg-card ring-0 shadow-none";

/** Abgeschnittene Tabellenzellen: `@/components/ui/table-cell-truncate-tooltip`. */

export const moduleDataTableHeadSortButtonClassName =
  "inline-flex max-w-full items-center gap-1 text-left transition-colors";

export function moduleDataTableHeadSortButtonCn(
  _active: boolean,
  className?: string,
) {
  return cn(
    moduleDataTableHeadSortButtonClassName,
    moduleDataTableHeadLabelClassName,
    "hover:text-foreground",
    className,
  );
}
