/** Leichter Akzent-Hintergrund für Inhaber-Zeilen in Mitarbeiterliste / Schichtplan. */
export const staffOwnerRowSurfaceClassName =
  "bg-accent/[0.08] hover:bg-accent/[0.14]";

/**
 * Opaker Inhaber-Tint für sticky Zellen — mischt Akzent mit Card,
 * damit horizontal scrollende Schichten nicht durchscheinen.
 */
export const staffOwnerStickySurfaceClassName =
  "bg-[color-mix(in_oklch,var(--accent)_8%,var(--card))] hover:bg-[color-mix(in_oklch,var(--accent)_14%,var(--card))]";

/** Opaker Drop-/Hover-Tint für sticky Namenszellen (Wochen-Drop). */
export const staffOwnerStickyHighlightSurfaceClassName =
  "bg-[color-mix(in_oklch,var(--accent)_10%,var(--card))]";

export const staffOwnerRowCardClassName =
  "border-accent/35 bg-accent/[0.07] shadow-none";

export const staffOwnerBadgeClassName =
  "border-accent/40 bg-accent/15 text-foreground";
