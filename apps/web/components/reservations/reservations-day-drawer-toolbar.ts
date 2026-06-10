import { cn } from "@/lib/utils";

/** Icon-Aktionen im Tages-Drawer — gleiche Höhe/Stil wie Listen-/Tisch-Chips. */
export const reservationsDayDrawerHeaderActionButtonClassName = cn(
  "size-8 shrink-0 rounded-full border border-border/60 bg-muted/30 text-muted-foreground shadow-none",
  "hover:bg-muted/50 hover:text-foreground dark:shadow-xs",
);
