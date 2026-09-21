import { cn } from "@/lib/utils";

/**
 * Tagesnotiz- / Schicht-Aktion in Tageskarten (kompakt neben Datum).
 */
export const reservationDayNoteChipClassName = cn(
  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full",
  "border border-accent/40 bg-accent/10 text-accent",
  "transition-colors hover:bg-accent/15 active:bg-accent/25",
  "touch-manipulation [-webkit-tap-highlight-color:transparent]",
);

export const reservationDayNoteChipBadgeClassName = cn(
  "absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center",
  "rounded-full bg-accent px-0.5 text-[9px] font-semibold leading-none text-accent-foreground",
);
