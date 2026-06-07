"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { computeReorderInsertIndex } from "@/lib/dnd/reorder-indices";
import {
  gapBeforeRowIndex,
  measureSortableGapLine,
  type SortableGapLineRect,
} from "@/lib/dnd/sortable-gap-line";
import { cn } from "@/lib/utils";

export type SortableDropPlacement = "before" | "after";

const DRAG_START_THRESHOLD_PX = 6;

export type SortableDragLayout = {
  pointerX: number;
  pointerY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  ghostWidth: number;
  ghostHeight: number;
  gapLine: SortableGapLineRect | null;
};

export type UseSortableReorderResult<TId extends string> = {
  activeId: TId | null;
  overId: TId | null;
  dropPlacement: SortableDropPlacement | null;
  wouldReorder: boolean;
  dragLayout: SortableDragLayout | null;
  registerItemRef: (id: TId, el: HTMLElement | null) => void;
  getHandleProps: (id: TId) => {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
    className: string;
    style: { touchAction: "none" };
    "aria-grabbed": boolean | undefined;
  };
  getItemDropClassName: (id: TId, className?: string) => string;
  isDragging: (id: TId) => boolean;
};

export type SortableReorderEvent<TId extends string> = {
  dragId: TId;
  overId: TId;
  placement: SortableDropPlacement;
  fromIndex: number;
  toIndex: number;
};

export function useSortableReorder<TId extends string>({
  itemIds,
  onReorder,
  disabled = false,
}: {
  itemIds: readonly TId[];
  onReorder: (event: SortableReorderEvent<TId>) => void;
  disabled?: boolean;
}): UseSortableReorderResult<TId> {
  const [activeId, setActiveId] = useState<TId | null>(null);
  const [overId, setOverId] = useState<TId | null>(null);
  const [dropPlacement, setDropPlacement] =
    useState<SortableDropPlacement | null>(null);
  const [dragLayout, setDragLayout] = useState<SortableDragLayout | null>(null);

  const itemRefs = useRef(new Map<TId, HTMLElement>());
  const pendingRef = useRef<{
    id: TId;
    pointerId: number;
    startX: number;
    startY: number;
    handleEl: HTMLElement;
  } | null>(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const activeIdRef = useRef<TId | null>(null);
  activeIdRef.current = activeId;

  const originIndex = useMemo(() => {
    if (!activeId) return -1;
    return itemIds.indexOf(activeId);
  }, [activeId, itemIds]);

  const insertIndex = useMemo(() => {
    if (!activeId || originIndex < 0) return null;
    if (!overId || !dropPlacement) return originIndex;
    const overIndex = itemIds.indexOf(overId);
    if (overIndex < 0) return originIndex;
    return computeReorderInsertIndex(originIndex, overIndex, dropPlacement);
  }, [activeId, originIndex, overId, dropPlacement, itemIds]);

  const wouldReorder =
    insertIndex !== null && originIndex >= 0 && insertIndex !== originIndex;

  const registerItemRef = useCallback((id: TId, el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  const wouldReorderForTarget = useCallback(
    (dragId: TId, target: { id: TId; placement: SortableDropPlacement }) => {
      const from = itemIds.indexOf(dragId);
      const overIndex = itemIds.indexOf(target.id);
      if (from < 0 || overIndex < 0) return false;
      const to = computeReorderInsertIndex(from, overIndex, target.placement);
      return from !== to;
    },
    [itemIds],
  );

  const measureDragLayout = useCallback(
    (
      dragId: TId,
      clientX: number,
      clientY: number,
      target: { id: TId; placement: SortableDropPlacement } | null,
    ) => {
      const rowEl = itemRefs.current.get(dragId);
      if (!rowEl) {
        setDragLayout(null);
        return;
      }
      const rowRect = rowEl.getBoundingClientRect();
      let gapLine: SortableGapLineRect | null = null;

      if (target && wouldReorderForTarget(dragId, target)) {
        const overIndex = itemIds.indexOf(target.id);
        if (overIndex >= 0) {
          const gapRow = gapBeforeRowIndex(overIndex, target.placement);
          gapLine = measureSortableGapLine(gapRow, itemIds, itemRefs.current);
        }
      }

      setDragLayout({
        pointerX: clientX,
        pointerY: clientY,
        grabOffsetX: grabOffsetRef.current.x,
        grabOffsetY: grabOffsetRef.current.y,
        ghostWidth: rowRect.width,
        ghostHeight: rowRect.height,
        gapLine,
      });
    },
    [itemIds, wouldReorderForTarget],
  );

  const clearDrag = useCallback(() => {
    pendingRef.current = null;
    setActiveId(null);
    setOverId(null);
    setDropPlacement(null);
    setDragLayout(null);
    if (typeof document !== "undefined") {
      document.body.style.removeProperty("touch-action");
      document.body.style.removeProperty("user-select");
    }
  }, []);

  const resolveDropTarget = useCallback(
    (clientY: number): { id: TId; placement: SortableDropPlacement } | null => {
      for (const id of itemIds) {
        const el = itemRefs.current.get(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top || clientY > rect.bottom) continue;
        const mid = rect.top + rect.height / 2;
        return { id, placement: clientY < mid ? "before" : "after" };
      }
      const lastId = itemIds[itemIds.length - 1];
      if (lastId) {
        const el = itemRefs.current.get(lastId);
        if (el && clientY > el.getBoundingClientRect().bottom) {
          return { id: lastId, placement: "after" };
        }
      }
      return null;
    },
    [itemIds],
  );

  const commitDrop = useCallback(
    (dragId: TId, target: { id: TId; placement: SortableDropPlacement }) => {
      const from = itemIds.indexOf(dragId);
      const overIndex = itemIds.indexOf(target.id);
      if (from < 0 || overIndex < 0) return;
      const to = computeReorderInsertIndex(from, overIndex, target.placement);
      if (from === to) return;
      onReorder({
        dragId,
        overId: target.id,
        placement: target.placement,
        fromIndex: from,
        toIndex: to,
      });
    },
    [itemIds, onReorder],
  );

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const pending = pendingRef.current;
      const active = activeIdRef.current;

      if (pending && !active) {
        const dx = ev.clientX - pending.startX;
        const dy = ev.clientY - pending.startY;
        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
        try {
          pending.handleEl.setPointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        const rowEl = itemRefs.current.get(pending.id);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          grabOffsetRef.current = {
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
          };
        }
        setActiveId(pending.id);
        activeIdRef.current = pending.id;
        pendingRef.current = null;
        if (typeof document !== "undefined") {
          document.body.style.touchAction = "none";
          document.body.style.userSelect = "none";
        }
      }

      const dragId = activeIdRef.current;
      if (!dragId) return;

      const target = resolveDropTarget(ev.clientY);
      if (target) {
        setOverId(target.id);
        setDropPlacement(target.placement);
      } else {
        setOverId(null);
        setDropPlacement(null);
      }

      measureDragLayout(dragId, ev.clientX, ev.clientY, target);
    };

    const onUp = (ev: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending?.pointerId === ev.pointerId) {
        pendingRef.current = null;
        return;
      }

      const dragId = activeIdRef.current;
      if (!dragId) return;

      const target = resolveDropTarget(ev.clientY);
      if (target) commitDrop(dragId, target);

      try {
        if (ev.target instanceof Element && ev.pointerId != null) {
          (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
        }
      } catch {
        /* ignore */
      }
      clearDrag();
    };

    const onCancel = () => clearDrag();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [clearDrag, commitDrop, measureDragLayout, resolveDropTarget]);

  const getHandleProps = useCallback(
    (id: TId) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (disabled || e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const rowEl = itemRefs.current.get(id);
        if (rowEl) {
          const rect = rowEl.getBoundingClientRect();
          grabOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          };
        }
        pendingRef.current = {
          id,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          handleEl: e.currentTarget as HTMLElement,
        };
      },
      onPointerCancel: () => {
        if (pendingRef.current?.id === id) pendingRef.current = null;
        if (activeIdRef.current === id) clearDrag();
      },
      className: cn(
        "cursor-grab touch-none select-none active:cursor-grabbing",
        activeId === id && "cursor-grabbing",
      ),
      style: { touchAction: "none" as const },
      "aria-grabbed": activeId === id ? true : undefined,
    }),
    [disabled, activeId, clearDrag],
  );

  const getItemDropClassName = useCallback(
    (id: TId, className?: string) =>
      cn(
        "relative transition-[opacity,transform] duration-150",
        activeId === id &&
          "pointer-events-none opacity-[0.22] [transform:scale(0.99)]",
        className,
      ),
    [activeId],
  );

  const isDragging = useCallback((id: TId) => activeId === id, [activeId]);

  return {
    activeId,
    overId,
    dropPlacement,
    wouldReorder,
    dragLayout,
    registerItemRef,
    getHandleProps,
    getItemDropClassName,
    isDragging,
  };
}
