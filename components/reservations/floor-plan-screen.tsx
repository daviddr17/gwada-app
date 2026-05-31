"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Minus, Pencil, Plus, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DiningAreaDrawer,
  type DiningAreaSavePayload,
} from "@/components/reservations/dining-area-drawer";
import { DiningAreaTabs } from "@/components/reservations/dining-area-tabs";
import { DiningTableDrawer } from "@/components/reservations/dining-table-drawer";
import {
  FloorTableChairsAround,
  floorTableChairInsetPx,
} from "@/components/reservations/floor-table-chairs";
import {
  anchorForResizeCorner,
  clampPct,
  clientToCanvasPct,
  computeResizedTableRect,
  floorPlanTableUiScale,
  parseTableHex,
  tablePlanMutedClass,
  tablePlanTextClass,
  type FloorResizeCorner,
} from "@/components/reservations/floor-plan-geometry";
import {
  deleteDiningArea,
  deleteDiningTable,
  fetchDiningAreas,
  fetchDiningTables,
  formatDiningTableLabel,
  insertDiningArea,
  pickMostRecentlyCreatedDiningTable,
  updateDiningArea,
  updateDiningTable,
  type DiningAreaRow,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

function resizeCursor(corner: FloorResizeCorner): string {
  switch (corner) {
    case "nw":
    case "se":
      return "cursor-nwse-resize";
    case "ne":
    case "sw":
      return "cursor-nesw-resize";
  }
}

const FLOOR_PLAN_ZOOM_MIN = 0.4;
const FLOOR_PLAN_ZOOM_MAX = 2.5;
const FLOOR_PLAN_ZOOM_STEP = 0.15;

function clampZoom(z: number): number {
  return Math.min(FLOOR_PLAN_ZOOM_MAX, Math.max(FLOOR_PLAN_ZOOM_MIN, z));
}

export function FloorPlanScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [areas, setAreas] = useState<DiningAreaRow[]>([]);
  const [tables, setTables] = useState<DiningTableRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaDrawerOpen, setAreaDrawerOpen] = useState(false);
  const [areaDrawerMode, setAreaDrawerMode] = useState<"create" | "edit">("create");
  const [areaEditInitial, setAreaEditInitial] = useState<DiningAreaRow | null>(null);
  const [tableDrawerOpen, setTableDrawerOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTableRow | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [deleteFloorTarget, setDeleteFloorTarget] = useState<
    | { kind: "area"; row: DiningAreaRow }
    | { kind: "table"; row: DiningTableRow }
    | null
  >(null);
  const [drag, setDrag] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    rectW: number;
    rectH: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const [resize, setResize] = useState<{
    id: string;
    corner: FloorResizeCorner;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    id: string;
    cx: number;
    cy: number;
    w: number;
    h: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  /** rAF-Batching für Drag-/Resize-Move (weniger Re-Renders). */
  const dragMoveRafRef = useRef<number | null>(null);
  const resizeMoveRafRef = useRef<number | null>(null);
  const dragPendingPctRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const pointerCaptureRef = useRef<{
    el: HTMLElement;
    pointerId: number;
  } | null>(null);
  const resizePendingRef = useRef<{
    id: string;
    cx: number;
    cy: number;
    w: number;
    h: number;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      setZoom((z) => clampZoom(z * factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomWorldStyle = useMemo(
    () =>
      ({
        width: `${100 * zoom}%`,
      }) as const,
    [zoom],
  );

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100));
  }, []);

  const resetZoom = useCallback(() => setZoom(1), []);

  const loadAll = useCallback(async () => {
    if (!restaurantId) return;
    const [aRes, tRes] = await Promise.all([
      fetchDiningAreas(restaurantId),
      fetchDiningTables(restaurantId),
    ]);
    if (aRes.error) toast.error(aRes.error.message);
    if (tRes.error) toast.error(tRes.error.message);
    let nextAreas = aRes.data;
    if (nextAreas.length === 0) {
      const ins = await insertDiningArea({
        restaurantId,
        name: "Innenraum",
        displayNumber: 1,
        colorHex: "#64748b",
        sortOrder: 1,
      });
      if (ins.error) toast.error(ins.error.message);
      else if (ins.data) nextAreas = [ins.data];
    }
    setAreas(nextAreas);
    setTables(tRes.data);
    setSelectedAreaId((prev) => {
      if (prev && nextAreas.some((a) => a.id === prev)) return prev;
      return nextAreas[0]?.id ?? null;
    });
  }, [restaurantId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, reloadNonce]);

  const tablesInArea = useMemo(
    () => tables.filter((t) => t.area_id === selectedAreaId),
    [tables, selectedAreaId],
  );

  const seatsInArea = useMemo(
    () =>
      tablesInArea.reduce((sum, t) => {
        const c = Number(t.capacity);
        return sum + (Number.isFinite(c) && c > 0 ? c : 0);
      }, 0),
    [tablesInArea],
  );

  const nextTableNumber = useMemo(() => {
    if (!selectedAreaId) return 1;
    const nums = tablesInArea.map((t) => t.table_number);
    return nums.length ? Math.max(...nums) + 1 : 1;
  }, [tablesInArea, selectedAreaId]);

  const nextAreaDisplayNumber = useMemo(() => {
    if (areas.length === 0) return 1;
    return Math.max(...areas.map((a) => a.display_number)) + 1;
  }, [areas]);

  const newTableStyleTemplate = useMemo(
    () => pickMostRecentlyCreatedDiningTable(tables),
    [tables],
  );

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const node = canvasRef.current;
      if (!node) return;
      setCanvasSize({ w: node.clientWidth, h: node.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedAreaId, tablesInArea.length, zoom, reloadNonce]);

  const bump = () => setReloadNonce((n) => n + 1);

  const persistArea = async (payload: DiningAreaSavePayload): Promise<boolean> => {
    if (!restaurantId) return false;
    if ("id" in payload) {
      const { error } = await updateDiningArea(payload.id, {
        name: payload.name,
        display_number: payload.displayNumber,
        color_hex: payload.colorHex,
        sort_order: payload.displayNumber,
      });
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Bereich gespeichert.");
      bump();
      return true;
    }
    const { error } = await insertDiningArea({
      restaurantId,
      name: payload.name,
      displayNumber: payload.displayNumber,
      colorHex: payload.colorHex,
      sortOrder: payload.displayNumber,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Bereich angelegt.");
    bump();
    return true;
  };

  const requestRemoveArea = (a: DiningAreaRow) => {
    if (tables.some((t) => t.area_id === a.id)) {
      toast.error("Bereich enthält noch Tische — zuerst Tische löschen oder verschieben.");
      return;
    }
    setDeleteFloorTarget({ kind: "area", row: a });
  };

  const requestRemoveTable = (t: DiningTableRow) => {
    setDeleteFloorTarget({ kind: "table", row: t });
  };

  const runFloorDelete = async () => {
    const t = deleteFloorTarget;
    if (!t) return;
    if (t.kind === "area") {
      const { error } = await deleteDiningArea(t.row.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Bereich gelöscht.");
        bump();
      }
    } else {
      const { error } = await deleteDiningTable(t.row.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Tisch gelöscht.");
        bump();
      }
    }
  };

  useEffect(() => {
    if (!drag && !resize) return;
    const vp = viewportRef.current;
    const prevTouchAction = vp?.style.touchAction;
    if (vp) vp.style.touchAction = "none";
    return () => {
      if (vp) vp.style.touchAction = prevTouchAction ?? "";
    };
  }, [drag, resize]);

  useEffect(() => {
    if (!drag) return;
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - drag.startClientX) / drag.rectW) * 100;
      const dy = ((ev.clientY - drag.startClientY) / drag.rectH) * 100;
      const x = clampPct(drag.origX + dx);
      const y = clampPct(drag.origY + dy);
      dragPendingPctRef.current = { id: drag.id, x, y };
      if (dragMoveRafRef.current !== null) return;
      dragMoveRafRef.current = requestAnimationFrame(() => {
        dragMoveRafRef.current = null;
        const p = dragPendingPctRef.current;
        if (p) setDragPreview({ id: p.id, x: p.x, y: p.y });
      });
    };
    const releaseCapture = () => {
      const cap = pointerCaptureRef.current;
      if (cap) {
        try {
          cap.el.releasePointerCapture(cap.pointerId);
        } catch {
          /* ignore */
        }
        pointerCaptureRef.current = null;
      }
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      releaseCapture();
      if (dragMoveRafRef.current !== null) {
        cancelAnimationFrame(dragMoveRafRef.current);
        dragMoveRafRef.current = null;
      }
      dragPendingPctRef.current = null;
      const dx = ((ev.clientX - drag.startClientX) / drag.rectW) * 100;
      const dy = ((ev.clientY - drag.startClientY) / drag.rectH) * 100;
      const nx = clampPct(drag.origX + dx);
      const ny = clampPct(drag.origY + dy);
      const id = drag.id;
      setTables((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, plan_x_pct: nx, plan_y_pct: ny } : row,
        ),
      );
      setDrag(null);
      setDragPreview(null);
      void (async () => {
        const { error } = await updateDiningTable(id, {
          plan_x_pct: nx,
          plan_y_pct: ny,
        });
        if (error) {
          toast.error(error.message);
          bump();
          return;
        }
        bump();
      })();
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      releaseCapture();
      setDrag(null);
      setDragPreview(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      if (dragMoveRafRef.current !== null) {
        cancelAnimationFrame(dragMoveRafRef.current);
        dragMoveRafRef.current = null;
      }
      dragPendingPctRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      releaseCapture();
    };
  }, [drag]);

  useEffect(() => {
    if (!resize) return;
    const move = (ev: PointerEvent) => {
      const el = canvasRef.current;
      if (!el) return;
      const pct = clientToCanvasPct(ev.clientX, ev.clientY, el.getBoundingClientRect());
      const r = computeResizedTableRect(
        resize.corner,
        resize.anchorX,
        resize.anchorY,
        pct.x,
        pct.y,
      );
      resizePendingRef.current = { id: resize.id, ...r };
      if (resizeMoveRafRef.current !== null) return;
      resizeMoveRafRef.current = requestAnimationFrame(() => {
        resizeMoveRafRef.current = null;
        const p = resizePendingRef.current;
        if (p) setResizePreview({ id: p.id, cx: p.cx, cy: p.cy, w: p.w, h: p.h });
      });
    };
    const releaseCapture = () => {
      const cap = pointerCaptureRef.current;
      if (cap) {
        try {
          cap.el.releasePointerCapture(cap.pointerId);
        } catch {
          /* ignore */
        }
        pointerCaptureRef.current = null;
      }
    };

    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      releaseCapture();
      if (resizeMoveRafRef.current !== null) {
        cancelAnimationFrame(resizeMoveRafRef.current);
        resizeMoveRafRef.current = null;
      }
      resizePendingRef.current = null;
      const el = canvasRef.current;
      const resizeId = resize.id;
      const corner = resize.corner;
      const ax = resize.anchorX;
      const ay = resize.anchorY;
      if (!el) {
        setResize(null);
        setResizePreview(null);
        bump();
        return;
      }
      const pct = clientToCanvasPct(ev.clientX, ev.clientY, el.getBoundingClientRect());
      const r = computeResizedTableRect(corner, ax, ay, pct.x, pct.y);
      setTables((prev) =>
        prev.map((row) =>
          row.id === resizeId
            ? {
                ...row,
                plan_x_pct: r.cx,
                plan_y_pct: r.cy,
                plan_w_pct: r.w,
                plan_h_pct: r.h,
              }
            : row,
        ),
      );
      setResize(null);
      setResizePreview(null);
      void (async () => {
        const { error } = await updateDiningTable(resizeId, {
          plan_x_pct: r.cx,
          plan_y_pct: r.cy,
          plan_w_pct: r.w,
          plan_h_pct: r.h,
        });
        if (error) {
          toast.error(error.message);
          bump();
          return;
        }
        bump();
      })();
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      releaseCapture();
      setResize(null);
      setResizePreview(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      if (resizeMoveRafRef.current !== null) {
        cancelAnimationFrame(resizeMoveRafRef.current);
        resizeMoveRafRef.current = null;
      }
      resizePendingRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      releaseCapture();
    };
  }, [resize]);

  const beginDrag = (e: React.PointerEvent, t: DiningTableRow) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-resize-corner]")) return;
    if (target?.closest("button")) return;
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    setDrag({
      id: t.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      rectW: Math.max(1, r.width),
      rectH: Math.max(1, r.height),
      origX: Number(t.plan_x_pct),
      origY: Number(t.plan_y_pct),
    });
    setDragPreview({
      id: t.id,
      x: Number(t.plan_x_pct),
      y: Number(t.plan_y_pct),
    });
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
      pointerCaptureRef.current = { el: handle, pointerId: e.pointerId };
    } catch {
      /* ignore */
    }
    e.preventDefault();
  };

  const beginResize = (e: React.PointerEvent, t: DiningTableRow, corner: FloorResizeCorner) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
      pointerCaptureRef.current = { el: handle, pointerId: e.pointerId };
    } catch {
      /* ignore */
    }
    const cx = Number(t.plan_x_pct);
    const cy = Number(t.plan_y_pct);
    const w = Number(t.plan_w_pct) || 13;
    const h = Number(t.plan_h_pct) || 20;
    const anchor = anchorForResizeCorner(corner, cx, cy, w, h);
    setResize({ id: t.id, corner, anchorX: anchor.x, anchorY: anchor.y });
    setResizePreview({ id: t.id, cx, cy, w, h });
  };

  const posFor = (t: DiningTableRow) => {
    if (resizePreview?.id === t.id) {
      return { left: resizePreview.cx, top: resizePreview.cy };
    }
    if (dragPreview?.id === t.id) {
      return { left: dragPreview.x, top: dragPreview.y };
    }
    return { left: Number(t.plan_x_pct), top: Number(t.plan_y_pct) };
  };

  const dimsFor = (t: DiningTableRow) => {
    if (resizePreview?.id === t.id) {
      return { w: resizePreview.w, h: resizePreview.h };
    }
    return { w: Number(t.plan_w_pct) || 13, h: Number(t.plan_h_pct) || 20 };
  };

  if (!supabaseEnvOk) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder className="min-h-[16rem]" />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="text-center" />;
  }

  return (
    <div className="space-y-6 pb-4">
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-4 pt-6">
          <DiningAreaTabs
            areas={areas}
            activeAreaId={selectedAreaId}
            onAreaSelect={setSelectedAreaId}
            onNewArea={() => {
              setAreaDrawerMode("create");
              setAreaEditInitial(null);
              setAreaDrawerOpen(true);
            }}
            onEditArea={(a) => {
              setAreaDrawerMode("edit");
              setAreaEditInitial(a);
              setAreaDrawerOpen(true);
            }}
            onDeleteArea={requestRemoveArea}
          />

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selectedAreaId ? (
                <>
                  {tablesInArea.length} Tisch{tablesInArea.length === 1 ? "" : "e"} ·{" "}
                  {seatsInArea === 1 ? "1 Platz" : `${seatsInArea} Plätze`} in diesem
                  Bereich
                </>
              ) : (
                "Kein Bereich gewählt."
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-full"
                  disabled={zoom <= FLOOR_PLAN_ZOOM_MIN + 1e-6}
                  aria-label="Verkleinern"
                  onClick={() => zoomBy(-FLOOR_PLAN_ZOOM_STEP)}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="min-w-[3.25rem] px-1 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-full"
                  disabled={zoom >= FLOOR_PLAN_ZOOM_MAX - 1e-6}
                  aria-label="Vergrößern"
                  onClick={() => zoomBy(FLOOR_PLAN_ZOOM_STEP)}
                >
                  <ZoomIn className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-full"
                  disabled={Math.abs(zoom - 1) < 1e-6}
                  aria-label="Zoom zurücksetzen"
                  onClick={resetZoom}
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={!selectedAreaId}
                onClick={() => {
                  setEditingTable(null);
                  setTableDrawerOpen(true);
                }}
              >
                <Plus className="mr-1 size-4" />
                Neuer Tisch
              </Button>
            </div>
          </div>

          <div
            ref={viewportRef}
            className="relative mx-auto aspect-[4/3] min-h-[12rem] w-full max-w-3xl overflow-auto overscroll-contain rounded-2xl border border-border/60 bg-muted/25 shadow-inner touch-pan-x touch-pan-y"
          >
            <div
              ref={canvasRef}
              className="relative shrink-0 aspect-[4/3] overflow-visible bg-muted/20"
              style={zoomWorldStyle}
            >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:20px_20px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />
            {dragPreview
              ? (() => {
                  const ghost = tablesInArea.find((t) => t.id === dragPreview.id);
                  if (!ghost) return null;
                  const gw = Number(ghost.plan_w_pct) || 13;
                  const gh = Number(ghost.plan_h_pct) || 20;
                  return (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute z-[25] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-dashed border-accent bg-accent/15 ring-4 ring-accent/20"
                      style={{
                        left: `${dragPreview.x}%`,
                        top: `${dragPreview.y}%`,
                        width: `${gw}%`,
                        height: `${gh}%`,
                      }}
                    />
                  );
                })()
              : null}
            {resizePreview
              ? (() => {
                  const ghost = tablesInArea.find((t) => t.id === resizePreview.id);
                  if (!ghost) return null;
                  return (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute z-[25] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-dashed border-accent/90 ring-4 ring-accent/25"
                      style={{
                        left: `${resizePreview.cx}%`,
                        top: `${resizePreview.cy}%`,
                        width: `${resizePreview.w}%`,
                        height: `${resizePreview.h}%`,
                      }}
                    />
                  );
                })()
              : null}
            {selectedAreaId &&
              tablesInArea.map((t) => {
                const { left, top } = posFor(t);
                const { w, h } = dimsFor(t);
                const ui = floorPlanTableUiScale(w, h);
                const hi = ui.resizeHandlePx / 2 + 2;
                const bg = parseTableHex(t.color_hex) ?? "#94a3b8";
                const activeDrag = drag?.id === t.id;
                const activeResize = resize?.id === t.id;
                const corners: FloorResizeCorner[] = ["nw", "ne", "sw", "se"];
                const capacity = Math.max(0, Number(t.capacity) || 0);
                const cellWpx =
                  canvasSize.w > 0 ? (w / 100) * canvasSize.w : 0;
                const cellHpx =
                  canvasSize.h > 0 ? (h / 100) * canvasSize.h : 0;
                const layoutWide = cellWpx > cellHpx * 1.02;
                const chairInset = floorTableChairInsetPx(
                  capacity,
                  cellWpx,
                  cellHpx,
                  layoutWide,
                );
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 touch-none overflow-visible",
                      (activeDrag || activeResize) && "z-30",
                      activeDrag && "will-change-[left,top]",
                    )}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${w}%`,
                      height: `${h}%`,
                    }}
                  >
                    <div className="relative h-full w-full overflow-visible">
                      {capacity > 0 && cellWpx >= 28 ? (
                        <FloorTableChairsAround
                          capacity={capacity}
                          reservations={[]}
                          cellWpx={cellWpx}
                          cellHpx={cellHpx}
                          layoutWide={layoutWide}
                        />
                      ) : null}
                      <div
                        className={cn(
                          "absolute flex cursor-grab flex-col overflow-hidden rounded-2xl border border-black/15 shadow-card active:cursor-grabbing dark:border-white/20",
                          activeDrag && "ring-2 ring-accent shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_25%,transparent)]",
                          activeResize && "ring-2 ring-accent/50 shadow-[0_0_0_4px_color-mix(in_oklch,var(--accent)_25%,transparent)]",
                        )}
                        style={{
                          backgroundColor: bg,
                          top: chairInset.top,
                          right: chairInset.right,
                          bottom: chairInset.bottom,
                          left: chairInset.left,
                        }}
                        onPointerDown={(e) => beginDrag(e, t)}
                      >
                      <div
                        className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"
                        style={{
                          padding: ui.contentPadPx,
                          gap: ui.contentGapPx,
                        }}
                      >
                        <span
                          className={cn(
                            "min-w-0 max-w-full truncate font-semibold leading-tight",
                            tablePlanTextClass(bg),
                          )}
                          style={{ fontSize: ui.labelPx }}
                        >
                          {formatDiningTableLabel(t)}
                        </span>
                        {ui.showCapacity ? (
                          <span
                            className={cn("leading-tight", tablePlanMutedClass(bg))}
                            style={{ fontSize: ui.sublabelPx }}
                          >
                            {t.capacity} Pl.
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={cn(
                          "flex shrink-0 justify-center border-t border-black/10 dark:border-white/15",
                        )}
                        style={{
                          gap: ui.toolbarGapPx,
                          paddingLeft: ui.contentPadPx,
                          paddingRight: ui.contentPadPx,
                          paddingTop: ui.toolbarPadYPx,
                          paddingBottom: ui.toolbarPadYPx,
                        }}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn(
                            "shrink-0 rounded-lg p-0 hover:bg-black/10 dark:hover:bg-white/15",
                            tablePlanTextClass(bg),
                          )}
                          style={{
                            width: ui.actionBtnPx,
                            height: ui.actionBtnPx,
                            minWidth: ui.actionBtnPx,
                            minHeight: ui.actionBtnPx,
                          }}
                          aria-label="Bearbeiten"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTable(t);
                            setTableDrawerOpen(true);
                          }}
                        >
                          <span className="sr-only">Bearbeiten</span>
                          <Pencil
                            className="shrink-0"
                            style={{ width: ui.iconPx, height: ui.iconPx }}
                            aria-hidden
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn(
                            "shrink-0 rounded-lg p-0 opacity-80 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/15",
                            tablePlanTextClass(bg),
                          )}
                          style={{
                            width: ui.actionBtnPx,
                            height: ui.actionBtnPx,
                            minWidth: ui.actionBtnPx,
                            minHeight: ui.actionBtnPx,
                          }}
                          aria-label="Löschen"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            requestRemoveTable(t);
                          }}
                        >
                          <Trash2
                            className="shrink-0"
                            style={{ width: ui.iconPx, height: ui.iconPx }}
                          />
                        </Button>
                      </div>
                      </div>

                    {corners.map((corner) => (
                      <div
                        key={corner}
                        data-resize-corner={corner}
                        role="presentation"
                        className={cn(
                          "absolute z-40 rounded-sm border border-border bg-background shadow-md",
                          resizeCursor(corner),
                        )}
                        style={{
                          width: ui.resizeHandlePx,
                          height: ui.resizeHandlePx,
                          ...(corner === "nw"
                            ? { left: -hi, top: -hi }
                            : corner === "ne"
                              ? { right: -hi, top: -hi }
                              : corner === "sw"
                                ? { left: -hi, bottom: -hi }
                                : { right: -hi, bottom: -hi }),
                        }}
                        onPointerDown={(e) => beginResize(e, t, corner)}
                      />
                    ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Zoom: Buttons oder <span className="font-medium text-foreground">Strg</span>/
            <span className="font-medium text-foreground">⌘</span> + Mausrad / Trackpad-Zoom
            auf dem Plan. Verschieben mit Scrollbalken oder Wischen.
          </p>
        </CardContent>
      </Card>

      <DiningAreaDrawer
        open={areaDrawerOpen}
        onOpenChange={(o) => {
          setAreaDrawerOpen(o);
          if (!o) setAreaEditInitial(null);
        }}
        mode={areaDrawerMode}
        initial={areaDrawerMode === "edit" ? areaEditInitial : null}
        suggestedDisplayNumber={nextAreaDisplayNumber}
        onSave={persistArea}
      />

      <DiningTableDrawer
        open={tableDrawerOpen}
        onOpenChange={(o) => {
          setTableDrawerOpen(o);
          if (!o) setEditingTable(null);
        }}
        restaurantId={restaurantId}
        areas={areas}
        defaultAreaId={selectedAreaId}
        table={editingTable}
        styleTemplate={editingTable ? null : newTableStyleTemplate}
        nextTableNumber={nextTableNumber}
        onSaved={bump}
      />

      <ConfirmDialog
        open={deleteFloorTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteFloorTarget(null);
        }}
        title={
          deleteFloorTarget?.kind === "area"
            ? "Bereich wirklich löschen?"
            : "Tisch wirklich löschen?"
        }
        description={
          deleteFloorTarget?.kind === "area" ? (
            <>
              Der Bereich „{deleteFloorTarget.row.name}“ wird dauerhaft entfernt.
            </>
          ) : deleteFloorTarget?.kind === "table" ? (
            <>
              Der Tisch „{formatDiningTableLabel(deleteFloorTarget.row)}“ wird
              dauerhaft entfernt.
            </>
          ) : null
        }
        confirmLabel="Ja, löschen"
        onConfirm={runFloorDelete}
      />
    </div>
  );
}
