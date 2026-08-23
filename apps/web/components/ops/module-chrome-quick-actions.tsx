"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Plus } from "lucide-react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { Button } from "@/components/ui/button";
import {
  applyConversationReadFilterToSearchParams,
  parseConversationReadFilter,
} from "@/lib/contact-messages/filter-conversations";
import { cn } from "@/lib/utils";

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

const NACHRICHTEN_PATH = "/dashboard/kontakte/nachrichten";

/**
 * Nachrichten: Ungelesen-Filter im Sticky-Header.
 * Toggle (an/aus) mit sichtbarem Aktiv-Zustand — kein toter Soft-Nav-Link.
 */
export function MessagesChromeActions() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const unreadActive =
    parseConversationReadFilter(searchParams.get("read")) === "unread";

  const toggleUnread = useCallback(() => {
    const onNachrichten =
      pathname === NACHRICHTEN_PATH ||
      pathname.startsWith(`${NACHRICHTEN_PATH}/`);
    const params = new URLSearchParams(
      onNachrichten ? searchParams.toString() : "",
    );
    if (!params.get("platform")) {
      params.set("platform", "all");
    }
    applyConversationReadFilterToSearchParams(
      params,
      unreadActive ? "all" : "unread",
    );
    params.delete("contact");
    router.replace(`${NACHRICHTEN_PATH}?${params.toString()}`, {
      scroll: false,
    });
  }, [pathname, router, searchParams, unreadActive]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn(
        "shrink-0 rounded-full border-border/60",
        unreadActive && "border-accent/50 bg-accent/15 text-accent",
      )}
      aria-label={
        unreadActive
          ? "Ungelesen-Filter aus — alle Chats"
          : "Nur ungelesene Nachrichten"
      }
      aria-pressed={unreadActive}
      title={unreadActive ? "Alle Chats zeigen" : "Nur Ungelesene"}
      onClick={toggleUnread}
    >
      <Filter className="size-4" />
    </Button>
  );
}
