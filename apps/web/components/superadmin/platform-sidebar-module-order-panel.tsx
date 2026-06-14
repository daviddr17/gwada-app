"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import {
  SIDEBAR_MODULE_BY_ID,
  reorderSidebarModuleOrder,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import { useSidebarModuleOrder } from "@/lib/contexts/sidebar-module-order-context";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import { patchSuperadminSidebarModuleOrder } from "@/lib/superadmin/platform-app-settings-api";
import { cn } from "@/lib/utils";

export function PlatformSidebarModuleOrderPanel() {
  const { order: liveOrder, applyOrder } = useSidebarModuleOrder();
  const [order, setOrder] = useState<SidebarModuleId[]>(liveOrder);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOrder(liveOrder);
  }, [liveOrder]);

  const orderedModules = useMemo(
    () => order.map((id) => SIDEBAR_MODULE_BY_ID.get(id)!),
    [order],
  );

  const persistOrder = useCallback(
    async (next: SidebarModuleId[]) => {
      const previous = order;
      setOrder(next);
      setSaving(true);
      try {
        const data = await patchSuperadminSidebarModuleOrder(next);
        applyOrder(data.sidebarModuleOrder);
        toast.success("Modul-Reihenfolge gespeichert.");
      } catch (e) {
        setOrder(previous);
        toast.error(
          e instanceof Error
            ? e.message
            : "Reihenfolge konnte nicht gespeichert werden.",
        );
      } finally {
        setSaving(false);
      }
    },
    [applyOrder, order],
  );

  const sort = useSortableReorder({
    itemIds: order,
    disabled: saving,
    onReorder: ({ dragId, overId, placement }) => {
      const overIndex = order.indexOf(overId);
      const dropId =
        placement === "after" ? (order[overIndex + 1] ?? overId) : overId;
      if (dragId === dropId) return;
      void persistOrder(
        reorderSidebarModuleOrder(
          order,
          dragId as SidebarModuleId,
          dropId as SidebarModuleId,
        ),
      );
    },
  });

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader>
        <CardTitle>Modul-Reihenfolge</CardTitle>
        <CardDescription>
          Reihenfolge der Module in der App-Sidebar (Dashboard bleibt oben).
          Änderungen gelten plattformweit für alle Nutzer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul
          className="list-none space-y-2 p-0"
          aria-label="Sidebar-Module"
          aria-busy={saving}
        >
          {orderedModules.map((mod) => {
            const handle = sort.getHandleProps(mod.id);
            const Icon = mod.icon;
            return (
              <li key={mod.id}>
                <div
                  ref={(el) => sort.registerItemRef(mod.id, el)}
                  className={sort.getItemDropClassName(
                    mod.id,
                    "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/15 py-2 pe-3 ps-2",
                  )}
                >
                  <button
                    type="button"
                    {...handle}
                    disabled={saving}
                    aria-label={`${mod.label} verschieben`}
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground disabled:opacity-50",
                      handle.className,
                    )}
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 text-sm font-medium text-foreground">
                    {mod.label}
                  </span>
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
            const mod = SIDEBAR_MODULE_BY_ID.get(id as SidebarModuleId);
            if (!mod) return null;
            const Icon = mod.icon;
            return (
              <div className="flex items-center gap-3 px-3 py-2">
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{mod.label}</span>
              </div>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
