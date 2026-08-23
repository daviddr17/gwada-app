"use client";

import { Filter, Plus } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";

/** Reservierungen: Schnell „Neu“. */
export function ReservationsChromeActions() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="shrink-0 rounded-full border-border/60"
      aria-label="Neue Reservierung"
      title="Neue Reservierung"
      render={<AppNavLink href="/dashboard/reservierungen?new=1" />}
    >
      <Plus className="size-4" />
    </Button>
  );
}

/** Nachrichten: ungelesen filtern. */
export function MessagesChromeActions() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="shrink-0 rounded-full border-border/60"
      aria-label="Ungelesene Nachrichten"
      title="Ungelesen"
      render={
        <AppNavLink href="/dashboard/kontakte/nachrichten?platform=all&read=unread" />
      }
    >
      <Filter className="size-4" />
    </Button>
  );
}
