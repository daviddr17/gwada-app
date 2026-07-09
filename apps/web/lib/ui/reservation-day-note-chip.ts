import { cn } from "@/lib/utils";

/** Tagesnotiz-Chip in Reservierungs-Tageskarten (Übersicht). */
export const reservationDayNoteChipClassName = cn(
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium leading-none",
  "border-accent/35 bg-accent/10 text-accent",
  "transition-colors hover:bg-accent/15 active:bg-accent/20",
);
