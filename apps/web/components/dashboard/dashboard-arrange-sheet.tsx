"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DASHBOARD_WIDGET_OPTIONS,
  type DashboardWidgetId,
  type DashboardWidgetPrefs,
} from "@/lib/constants/dashboard-widgets";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerChromeMaxWidthClassName } from "@/lib/ui/drawer-chrome";
import { cn } from "@/lib/utils";

type Visibility = DashboardWidgetPrefs["visibility"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardWidgetId[];
  /** Nutzer-Prefs (ohne Permission-Maske) — Speichern schreibt diese zurück. */
  visibility: Visibility;
  /** Widgets, die die Rolle überhaupt sehen darf. */
  permittedIds: readonly DashboardWidgetId[];
  onApply: (next: { order: DashboardWidgetId[]; visibility: Visibility }) => void;
};

function labelFor(id: DashboardWidgetId): string {
  return DASHBOARD_WIDGET_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function mergeOrder(
  preferred: DashboardWidgetId[],
  visibility: Visibility,
  permitted: ReadonlySet<DashboardWidgetId>,
): DashboardWidgetId[] {
  const seen = new Set<DashboardWidgetId>();
  const out: DashboardWidgetId[] = [];
  for (const id of preferred) {
    if (!permitted.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of permitted) {
    if (!seen.has(id)) out.push(id);
  }
  const visible = out.filter((id) => visibility[id]);
  const hidden = out.filter((id) => !visibility[id]);
  return [...visible, ...hidden];
}

export function DashboardArrangeSheet({
  open,
  onOpenChange,
  order,
  visibility,
  permittedIds,
  onApply,
}: Props) {
  const permitted = new Set(permittedIds);
  const [draftOrder, setDraftOrder] = useState<DashboardWidgetId[]>(() =>
    mergeOrder(order, visibility, permitted),
  );
  const [draftVisibility, setDraftVisibility] = useState<Visibility>(visibility);
  const dragIdRef = useRef<DashboardWidgetId | null>(null);
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextPermitted = new Set(permittedIds);
    setDraftVisibility(visibility);
    setDraftOrder(mergeOrder(order, visibility, nextPermitted));
    dragIdRef.current = null;
    setDraggingId(null);
  }, [open, order, visibility, permittedIds]);

  const visibleIds = draftOrder.filter((id) => draftVisibility[id]);
  const hiddenIds = draftOrder.filter((id) => !draftVisibility[id]);

  function toggle(id: DashboardWidgetId, next: boolean) {
    setDraftVisibility((prev) => {
      const visibilityNext = { ...prev, [id]: next };
      setDraftOrder((ord) => mergeOrder(ord, visibilityNext, permitted));
      return visibilityNext;
    });
  }

  function moveVisible(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setDraftOrder((prev) => {
      const vis = prev.filter((id) => draftVisibility[id]);
      const hid = prev.filter((id) => !draftVisibility[id]);
      if (from >= vis.length || to >= vis.length) return prev;
      const nextVis = [...vis];
      const [item] = nextVis.splice(from, 1);
      if (!item) return prev;
      nextVis.splice(to, 0, item);
      return [...nextVis, ...hid];
    });
  }

  function handlePointerDown(id: DashboardWidgetId, e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragIdRef.current = id;
    setDraggingId(id);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const dragId = dragIdRef.current;
    if (!dragId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest("[data-arrange-id]") as HTMLElement | null;
    const overId = row?.dataset.arrangeId as DashboardWidgetId | undefined;
    if (!overId || overId === dragId || !draftVisibility[overId]) return;
    const from = visibleIds.indexOf(dragId);
    const to = visibleIds.indexOf(overId);
    if (from < 0 || to < 0) return;
    moveVisible(from, to);
  }

  function handlePointerUp(e: React.PointerEvent) {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragIdRef.current = null;
    setDraggingId(null);
  }

  function handleSave() {
    onApply({
      order: mergeOrder(draftOrder, draftVisibility, permitted),
      visibility: draftVisibility,
    });
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={cn("mx-auto", drawerChromeMaxWidthClassName)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>Dashboard anordnen</DrawerTitle>
          <DrawerDescription>
            Ein- und ausblenden, sichtbare Kacheln per Ziehen sortieren.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex max-h-[min(60vh,28rem)] flex-col gap-4 overflow-y-auto px-4 pb-2">
          <ul className="flex flex-col gap-1.5">
            {visibleIds.map((id) => (
              <li
                key={id}
                data-arrange-id={id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-border/50 bg-card px-2 py-2.5",
                  draggingId === id && "opacity-70 ring-2 ring-ring",
                )}
              >
                <button
                  type="button"
                  aria-label={`${labelFor(id)} verschieben`}
                  className="touch-none rounded-md p-1 text-muted-foreground hover:bg-muted/60"
                  onPointerDown={(e) => handlePointerDown(id, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <GripVertical className="size-4" />
                </button>
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {labelFor(id)}
                </span>
                <Switch
                  checked
                  onCheckedChange={(v) => toggle(id, v === true)}
                  aria-label={`${labelFor(id)} anzeigen`}
                />
              </li>
            ))}
          </ul>

          {hiddenIds.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Ausgeblendet</p>
              <ul className="flex flex-col gap-1.5">
                {hiddenIds.map((id) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-border/40 bg-muted/20 px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {labelFor(id)}
                    </span>
                    <Switch
                      checked={false}
                      onCheckedChange={(v) => toggle(id, v === true)}
                      aria-label={`${labelFor(id)} anzeigen`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DrawerFooter className="flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" className={brandActionButtonRoundedClassName} onClick={handleSave}>
            Fertig
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
