"use client";

import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReservationInternalNoteIndicator({
  className,
}: {
  className?: string;
}) {
  return (
    <StickyNote
      className={cn("size-3.5 shrink-0 text-accent", className)}
      aria-label="Interne Notiz"
    />
  );
}

/** Kleingedruckte Notiz direkt an der Reservierung — Text sichtbar, kein Tooltip. */
export function ReservationInternalNoteFinePrint({
  note,
  className,
}: {
  note: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex min-w-0 items-start gap-1 text-[10px] font-medium leading-snug text-amber-800 dark:text-amber-200",
        className,
      )}
    >
      <StickyNote className="mt-px size-3 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 whitespace-pre-wrap break-words">{note}</span>
    </p>
  );
}
