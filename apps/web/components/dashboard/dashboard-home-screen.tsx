"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, LayoutGrid } from "lucide-react";
import { DashboardArrangeSheet } from "@/components/dashboard/dashboard-arrange-sheet";
import { DashboardCalendarOverlay } from "@/components/dashboard/dashboard-calendar-overlay";
import { DashboardFab } from "@/components/dashboard/dashboard-fab";
import { DashboardHomePage } from "@/components/dashboard/dashboard-home-page";
import { AppMain } from "@/components/layout/app-main";
import { PendingStaffInviteBanner } from "@/components/staff/pending-staff-invite-banner";
import { DashboardBatchQuerySync } from "@/components/providers/dashboard-batch-query-sync";
import { Button } from "@/components/ui/button";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useDashboardPageBackgroundRefresh } from "@/lib/dashboard/dashboard-widget-refresh";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Dashboard-Home — Keep-alive unter App-Shell; `active` steuert Arbeit/FAB, `showChrome` den Header. */
export function DashboardHomeScreen({
  active = true,
  showChrome = active,
}: {
  active?: boolean;
  showChrome?: boolean;
}) {
  useDashboardPageBackgroundRefresh(active);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const prefs = useDashboardWidgetPreferences();
  const { permittedWidgetIds } = useDashboardEffectiveWidgetPrefs();

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘⇧C / Ctrl+⇧C — nicht ⌘C (System-Kopieren).
      if (
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        event.key.toLowerCase() !== "c"
      ) {
        return;
      }
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setCalendarOpen((open) => !open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0 rounded-full border-border/60"
          aria-label="Kalender (⇧⌘C)"
          title="Kalender (⇧⌘C)"
          onClick={() => setCalendarOpen(true)}
        >
          <CalendarDays className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0 rounded-full border-border/60"
          aria-label="Dashboard anordnen"
          title="Dashboard anordnen"
          onClick={() => setArrangeOpen(true)}
        >
          <LayoutGrid className="size-4" />
        </Button>
      </div>
    ),
    [],
  );

  return (
    <>
      {active ? <DashboardBatchQuerySync /> : null}
      {showChrome ? (
        <RegisterModuleChrome
          title="Dashboard"
          subnavAriaLabel={null}
          subnavItems={null}
          headerActions={headerActions}
        />
      ) : null}
      <AppMain>
        <div className="space-y-4">
          <PendingStaffInviteBanner />
          <DashboardHomePage onOpenArrange={() => setArrangeOpen(true)} />
        </div>
      </AppMain>
      {active ? <DashboardFab /> : null}

      <DashboardCalendarOverlay
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
      <DashboardArrangeSheet
        open={arrangeOpen}
        onOpenChange={setArrangeOpen}
        order={prefs.order}
        visibility={prefs.visibility}
        permittedIds={permittedWidgetIds}
        onApply={(next) => prefs.applyWidgetLayout(next)}
      />
    </>
  );
}
