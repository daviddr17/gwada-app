import { cn } from "@/lib/utils";

/** Ganze Reservierungszeile klickbar (Bearbeiten) — Hover/Fokus wie Listeneintrag. */
export const reservationListRowButtonClassName = cn(
  "w-full cursor-pointer rounded-xl border border-border/40 bg-muted/15 px-3 py-2 text-left transition-colors",
  "hover:bg-muted/35 active:bg-muted/45",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

export const reservationListRowButtonCompactClassName = cn(
  "w-full cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-muted/10 text-left transition-colors",
  "hover:bg-muted/25 active:bg-muted/35",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

export const reservationListRowButtonDrawerFullClassName = cn(
  "flex w-full cursor-pointer gap-3 rounded-2xl border border-border/50 bg-muted/10 p-3 text-left transition-colors",
  "hover:bg-muted/25 active:bg-muted/35",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);
