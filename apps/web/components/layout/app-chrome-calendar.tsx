"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { DashboardCalendarOverlay } from "@/components/dashboard/dashboard-calendar-overlay";
import { Button } from "@/components/ui/button";
import { isRestaurantDashboardPath } from "@/lib/contexts/dashboard-global-search-context";
import { GWADA_OPS_OPEN_CALENDAR_EVENT } from "@/lib/ops/ops-commands";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Globaler Kalender im App-Chrome — auf allen Dashboard-Modulpfaden,
 * nicht nur auf dem Dashboard-Home (Modul-headerActions).
 */
export function AppChromeCalendar() {
  const pathname = usePathname();
  const show = isRestaurantDashboardPath(pathname);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) {
      setOpen(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        event.key.toLowerCase() !== "c"
      ) {
        return;
      }
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };

    const onOpsCalendar = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(GWADA_OPS_OPEN_CALENDAR_EVENT, onOpsCalendar);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(GWADA_OPS_OPEN_CALENDAR_EVENT, onOpsCalendar);
    };
  }, [show]);

  if (!show) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full border-border/60"
        aria-label="Kalender (⇧⌘C)"
        title="Kalender (⇧⌘C)"
        onClick={() => setOpen(true)}
      >
        <CalendarDays className="size-4" />
      </Button>
      <DashboardCalendarOverlay
        open={open}
        onClose={() => setOpen(false)}
        warm
      />
    </>
  );
}
