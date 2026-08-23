import { cn } from "@/lib/utils";

/**
 * Tagesnotiz- / Schicht-Aktion in Tageskarten.
 * Mobil: mind. 44×44 px Trefffläche, nicht in Meta-Textzeile quetschen.
 */
export const reservationDayNoteChipClassName = cn(
  "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
  "border border-accent/40 bg-accent/10 text-accent",
  "transition-colors hover:bg-accent/15 active:bg-accent/25",
  "touch-manipulation [-webkit-tap-highlight-color:transparent]",
);

export const reservationDayNoteChipBadgeClassName = cn(
  "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
  "rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground",
);
