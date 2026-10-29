"use client";

import { useMemo } from "react";
import { AppNavLink } from "@/components/navigation/app-nav-link";
import { GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import { DashboardWidgetsPanelSkeleton } from "@/components/settings/dashboard-widgets-panel-skeleton";
import {
  DASHBOARD_WIDGET_OPTIONS,
  type DashboardWidgetId,
} from "@/lib/constants/dashboard-widgets";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import { cn } from "@/lib/utils";

const OPTION_BY_ID = new Map(
  DASHBOARD_WIDGET_OPTIONS.map((o) => [o.id, o] as const),
);

export function DashboardWidgetsPanel() {
  const {
    visibility,
    order,
    setWidgetVisible,
    reorderWidgets,
    isReady,
    permittedWidgetIds,
  } = useDashboardEffectiveWidgetPrefs();

  const orderedOptions = useMemo(
    () =>
      order
        .filter((id) => permittedWidgetIds.includes(id))
        .map((id) => OPTION_BY_ID.get(id)!),
    [order, permittedWidgetIds],
  );

  const sort = useSortableReorder({
    itemIds: order,
    onReorder: ({ dragId, overId, placement }) => {
      const overIndex = order.indexOf(overId);
      const dropId =
        placement === "after"
          ? (order[overIndex + 1] ?? overId)
          : overId;
      if (dragId !== dropId) reorderWidgets(dragId, dropId);
    },
  });

  const prefsLoading = !isReady;
  const showSkeleton = useDeferredSkeleton(prefsLoading);

  if (prefsLoading) {
    if (showSkeleton) {
      return <DashboardWidgetsPanelSkeleton />;
    }
    return (
      <div
        className="min-h-[14rem] w-full"
        aria-busy="true"
        aria-label="Dashboard-Einstellungen werden geladen"
      />
    );
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-1.5 pb-3">
        <CardTitle className="text-base">Widgets</CardTitle>
        <CardDescription className="text-sm leading-snug">
          Auch direkt vom{" "}
          <AppNavLink
            href="/dashboard"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Dashboard
          </AppNavLink>{" "}
          über das Raster-Icon. Nur Module mit Rollenrecht und Abo — hier
          ein-/ausblenden und per Ziehen sortieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <ul className="list-none space-y-1 p-0" aria-label="Dashboard-Widgets">
          {orderedOptions.map((opt) => {
            const handle = sort.getHandleProps(opt.id);
            return (
              <li key={opt.id}>
                <div
                  ref={(el) => sort.registerItemRef(opt.id, el)}
                  className={sort.getItemDropClassName(
                    opt.id,
                    "flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/15 py-1 pe-2.5 ps-1",
                  )}
                >
                  <button
                    type="button"
                    {...handle}
                    aria-label={`${opt.label} verschieben`}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      handle.className,
                    )}
                  >
                    <GripVertical className="size-3.5" aria-hidden />
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0">
                      <span
                        id={`dashboard-widget-label-${opt.id}`}
                        className="block text-sm font-medium leading-tight text-foreground"
                      >
                        {opt.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        {opt.description}
                      </span>
                    </span>
                  </div>
                  <Switch
                    checked={visibility[opt.id]}
                    onCheckedChange={(v) => setWidgetVisible(opt.id, v === true)}
                    aria-labelledby={`dashboard-widget-label-${opt.id}`}
                    className="shrink-0 scale-90"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <SortableDragOverlay
          activeId={sort.activeId}
          dragLayout={sort.dragLayout}
          showGapLine={sort.wouldReorder}
          renderGhost={(id) => {
            const opt = OPTION_BY_ID.get(id as DashboardWidgetId);
            if (!opt) return null;
            return (
              <div className="flex gap-2 px-2 py-1">
                <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">
                    {opt.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </div>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
