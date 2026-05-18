"use client";

import { useMemo, useState } from "react";
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
import { DashboardWidgetsPanelSkeleton } from "@/components/settings/dashboard-widgets-panel-skeleton";
import {
  DASHBOARD_WIDGET_OPTIONS,
  type DashboardWidgetId,
} from "@/lib/constants/dashboard-widgets";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useDashboardWidgetPreferences } from "@/lib/hooks/use-dashboard-widget-preferences";
import { cn } from "@/lib/utils";

const OPTION_BY_ID = new Map(
  DASHBOARD_WIDGET_OPTIONS.map((o) => [o.id, o] as const),
);

const DND_MIME = "application/x-gwada-dashboard-widget";

export function DashboardWidgetsPanel() {
  const { visibility, order, setWidgetVisible, reorderWidgets, isReady } =
    useDashboardWidgetPreferences();
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null);

  const orderedOptions = useMemo(
    () => order.map((id) => OPTION_BY_ID.get(id)!),
    [order],
  );

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
          Reihenfolge. Angemeldet: gespeichert pro Restaurant und Benutzer in der
          Datenbank; ohne Anmeldung weiterhin pro Restaurant über den
          Workspace-Sync bzw. lokal in diesem Browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Zum Sortieren den Griff links gedrückt halten und auf eine andere Zeile
          ziehen.
        </p>
        <ul className="list-none space-y-2 p-0" aria-label="Dashboard-Widgets">
          {orderedOptions.map((opt) => (
            <li key={opt.id}>
              <div
                className={cn(
                  "flex gap-2 rounded-xl border border-border/40 bg-muted/15 py-2 pe-3 ps-2 transition-opacity sm:items-start",
                  draggingId === opt.id && "opacity-60",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData(DND_MIME);
                  const dragId = raw as DashboardWidgetId;
                  if (!dragId || dragId === opt.id) return;
                  reorderWidgets(dragId, opt.id);
                  setDraggingId(null);
                }}
              >
                <button
                  type="button"
                  draggable
                  aria-label={`${opt.label} verschieben`}
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground active:cursor-grabbing",
                  )}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_MIME, opt.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(opt.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <GripVertical className="size-4" aria-hidden />
                </button>
                <label className="flex min-w-0 flex-1 cursor-pointer gap-3 sm:items-start">
                  <Checkbox
                    checked={visibility[opt.id]}
                    onCheckedChange={(v) => setWidgetVisible(opt.id, v === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium leading-snug text-foreground">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-muted-foreground sm:text-sm">
                      {opt.description}
                    </span>
                  </span>
                </label>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
