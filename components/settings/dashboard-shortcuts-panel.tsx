"use client";

import { useMemo } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  resolveDashboardFabShortcuts,
  type DashboardShortcutId,
} from "@/lib/constants/dashboard-shortcuts";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
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
  } = useDashboardWidgetPreferences();

  const orderedOptions = useMemo(
    () => shortcuts.order.map((id) => OPTION_BY_ID.get(id)!),
    [shortcuts.order],
  );

  const activeFabShortcuts = useMemo(
    () => resolveDashboardFabShortcuts(shortcuts),
    [shortcuts],
  );

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
          Aktionen und ziehe sie in die gewünschte Reihenfolge — nur die ersten{" "}
          {DASHBOARD_FAB_MAX_SHORTCUTS} sichtbaren erscheinen im Menü.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Aktuell im Menü:{" "}
          <span className="font-medium text-foreground">
            {activeFabShortcuts.length} / {DASHBOARD_FAB_MAX_SHORTCUTS}
          </span>
          {activeFabShortcuts.length > 0
            ? ` — ${activeFabShortcuts.map((s) => s.label).join(", ")}`
            : " — mindestens einen Shortcut aktivieren."}
        </p>
        <ul className="list-none space-y-2 p-0" aria-label="Dashboard-Shortcuts">
          {orderedOptions.map((opt) => {
            const handle = sort.getHandleProps(opt.id);
            const Icon = opt.icon;
            return (
              <li key={opt.id}>
                <div
                  ref={(el) => sort.registerItemRef(opt.id, el)}
                  className={sort.getItemDropClassName(
                    opt.id,
                    "flex gap-2 rounded-xl border border-border/40 bg-muted/15 py-2 pe-3 ps-2 sm:items-start",
                  )}
                >
                  <button
                    type="button"
                    {...handle}
                    aria-label={`${opt.label} verschieben`}
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                      handle.className,
                    )}
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <label className="flex min-w-0 flex-1 cursor-pointer gap-3 sm:items-start">
                    <Checkbox
                      checked={shortcuts.visibility[opt.id]}
                      onCheckedChange={(v) =>
                        setShortcutVisible(opt.id, v === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="flex min-w-0 gap-3">
                      <span
                        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground"
                        aria-hidden
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 space-y-0.5">
                        <span className="block text-sm font-medium leading-snug text-foreground">
                          {opt.label}
                        </span>
                        <span className="block text-xs text-muted-foreground sm:text-sm">
                          {opt.description}
                        </span>
                      </span>
                    </span>
                  </label>
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
