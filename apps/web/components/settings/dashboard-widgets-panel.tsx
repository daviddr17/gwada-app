"use client";

import { useMemo } from "react";
import Link from "next/link";
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
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Dashboard</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Wähle, welche Bereiche auf dem{" "}
          <Link
            href="/dashboard"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Dashboard
          </Link>{" "}
          erscheinen, und ziehe sie per Ziehen und Ablegen in die gewünschte
          Reihenfolge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="list-none space-y-2 p-0" aria-label="Dashboard-Widgets">
          {orderedOptions.map((opt) => {
            const handle = sort.getHandleProps(opt.id);
            return (
              <li key={opt.id}>
                <div
                  ref={(el) => sort.registerItemRef(opt.id, el)}
                  className={sort.getItemDropClassName(
                    opt.id,
                    "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/15 py-2 pe-3 ps-2",
                  )}
                >
                  <button
                    type="button"
                    {...handle}
                    aria-label={`${opt.label} verschieben`}
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      handle.className,
                    )}
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="min-w-0 space-y-0.5">
                      <span
                        id={`dashboard-widget-label-${opt.id}`}
                        className="block text-sm font-medium leading-snug text-foreground"
                      >
                        {opt.label}
                      </span>
                      <span className="block text-xs text-muted-foreground sm:text-sm">
                        {opt.description}
                      </span>
                    </span>
                  </div>
                  <Switch
                    checked={visibility[opt.id]}
                    onCheckedChange={(v) => setWidgetVisible(opt.id, v === true)}
                    aria-labelledby={`dashboard-widget-label-${opt.id}`}
                    className="shrink-0"
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
              <div className="flex gap-3 px-3 py-2">
                <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">
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
