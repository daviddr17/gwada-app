"use client";

import { useMemo, useState } from "react";
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
  DASHBOARD_FAB_MAX_SHORTCUTS,
  DASHBOARD_SHORTCUT_OPTIONS,
  type DashboardShortcutId,
} from "@/lib/constants/dashboard-shortcuts";
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
      !hasDashboardShortcutAccess(has, id)
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
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Schnellaktionen</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Der Plus-Button unten rechts auf dem{" "}
          <Link
            href="/dashboard"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Dashboard
          </Link>{" "}
          öffnet bis zu {DASHBOARD_FAB_MAX_SHORTCUTS} Shortcuts. Aktiviere
          maximal {DASHBOARD_FAB_MAX_SHORTCUTS} Aktionen und ziehe sie in die
          gewünschte Reihenfolge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {visibleShortcutCount} / {DASHBOARD_FAB_MAX_SHORTCUTS}
          </span>{" "}
          ausgewählt
        </p>
        {limitError || overShortcutLimit ? (
          <p
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {overShortcutLimit
              ? `Es sind ${visibleShortcutCount} Shortcuts aktiv — maximal ${DASHBOARD_FAB_MAX_SHORTCUTS} erlaubt. Deaktiviere zuerst einen anderen.`
              : `Maximal ${DASHBOARD_FAB_MAX_SHORTCUTS} Shortcuts aktiv. Deaktiviere zuerst einen anderen.`}
          </p>
        ) : null}
        <ul className="list-none space-y-2 p-0" aria-label="Dashboard-Shortcuts">
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
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground"
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span
                        id={`dashboard-shortcut-label-${opt.id}`}
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
                    checked={isChecked}
                    disabled={switchDisabled}
                    onCheckedChange={(v) =>
                      handleShortcutVisibleChange(opt.id, v === true)
                    }
                    aria-labelledby={`dashboard-shortcut-label-${opt.id}`}
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
            const opt = OPTION_BY_ID.get(id as DashboardShortcutId);
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
