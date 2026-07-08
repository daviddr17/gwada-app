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
