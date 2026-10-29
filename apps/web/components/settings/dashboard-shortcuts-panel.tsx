"use client";

import { useMemo, useState } from "react";
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
  DASHBOARD_FAB_MAX_SHORTCUTS,
  DASHBOARD_SHORTCUT_OPTIONS,
  type DashboardShortcutId,
} from "@/lib/constants/dashboard-shortcuts";
import { useRestaurantBilling } from "@/lib/contexts/restaurant-billing-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasDashboardShortcutAccess } from "@/lib/permissions/dashboard-widget-permissions";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import { cn } from "@/lib/utils";

const OPTION_BY_ID = new Map(
  DASHBOARD_SHORTCUT_OPTIONS.map((o) => [o.id, o] as const),
);

export function DashboardShortcutsPanel() {
  const {
    shortcuts,
    setShortcutVisible,
    reorderShortcuts,
    isReady,
    permittedShortcutIds,
  } = useDashboardEffectiveWidgetPrefs();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const { entitlements } = useRestaurantBilling();

  const orderedOptions = useMemo(
    () =>
      shortcuts.order
        .filter((id) => permittedShortcutIds.includes(id))
        .map((id) => OPTION_BY_ID.get(id)!),
    [shortcuts.order, permittedShortcutIds],
  );

  const visibleShortcutCount = useMemo(
    () =>
      permittedShortcutIds.filter((id) => shortcuts.visibility[id]).length,
    [permittedShortcutIds, shortcuts.visibility],
  );

  const [limitError, setLimitError] = useState(false);

  const atShortcutLimit =
    visibleShortcutCount >= DASHBOARD_FAB_MAX_SHORTCUTS;
  const overShortcutLimit =
    visibleShortcutCount > DASHBOARD_FAB_MAX_SHORTCUTS;

  const handleShortcutVisibleChange = (
    id: DashboardShortcutId,
    checked: boolean,
  ) => {
    if (
      checked &&
      !permissionsLoading &&
      !hasDashboardShortcutAccess(has, id, entitlements)
    ) {
      return;
    }
    if (
      checked &&
      !shortcuts.visibility[id] &&
      visibleShortcutCount >= DASHBOARD_FAB_MAX_SHORTCUTS
    ) {
      setLimitError(true);
      return;
    }
    setLimitError(false);
    setShortcutVisible(id, checked);
  };

  const sort = useSortableReorder({
    itemIds: shortcuts.order,
    onReorder: ({ dragId, overId, placement }) => {
      const overIndex = shortcuts.order.indexOf(overId);
      const dropId =
        placement === "after"
          ? (shortcuts.order[overIndex + 1] ?? overId)
          : overId;
      if (dragId !== dropId) {
        reorderShortcuts(
          dragId as DashboardShortcutId,
          dropId as DashboardShortcutId,
        );
      }
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
        aria-label="Shortcut-Einstellungen werden geladen"
      />
    );
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-1.5 pb-3">
        <CardTitle className="text-base">Schnellaktionen</CardTitle>
        <CardDescription className="text-sm leading-snug">
          Plus-Button unten rechts auf dem{" "}
          <AppNavLink
            href="/dashboard"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Dashboard
          </AppNavLink>
          : max. {DASHBOARD_FAB_MAX_SHORTCUTS} Shortcuts, per Ziehen
          sortieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {visibleShortcutCount} / {DASHBOARD_FAB_MAX_SHORTCUTS}
          </span>{" "}
          ausgewählt
        </p>
        {limitError || overShortcutLimit ? (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
            role="alert"
          >
            {overShortcutLimit
              ? `Es sind ${visibleShortcutCount} Shortcuts aktiv — maximal ${DASHBOARD_FAB_MAX_SHORTCUTS} erlaubt. Deaktiviere zuerst einen anderen.`
              : `Maximal ${DASHBOARD_FAB_MAX_SHORTCUTS} Shortcuts aktiv. Deaktiviere zuerst einen anderen.`}
          </p>
        ) : null}
        <ul className="list-none space-y-1 p-0" aria-label="Dashboard-Shortcuts">
          {orderedOptions.map((opt) => {
            const handle = sort.getHandleProps(opt.id);
            const Icon = opt.icon;
            const isChecked = shortcuts.visibility[opt.id];
            const switchDisabled = !isChecked && atShortcutLimit;
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
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"
                      aria-hidden
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span
                        id={`dashboard-shortcut-label-${opt.id}`}
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
                    checked={isChecked}
                    disabled={switchDisabled}
                    onCheckedChange={(v) =>
                      handleShortcutVisibleChange(opt.id, v === true)
                    }
                    aria-labelledby={`dashboard-shortcut-label-${opt.id}`}
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
            const opt = OPTION_BY_ID.get(id as DashboardShortcutId);
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
