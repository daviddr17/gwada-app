import { cn } from "@/lib/utils";

/** Tagesnotiz-Chip in Reservierungs-Tageskarten — mobil treffbar (≥44px Höhe). */
export const reservationDayNoteChipClassName = cn(
  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium leading-none",
  "border-accent/35 bg-accent/10 text-accent",
  "transition-colors hover:bg-accent/15 active:bg-accent/20",
  "touch-manipulation",
);
