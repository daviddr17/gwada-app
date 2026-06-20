"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import { staffTodoPriorityBadgeClass } from "@/lib/staff/staff-todo-status";
import { displayActionToTrigger } from "@/lib/staff/staff-todo-display-triggers";
import { cn } from "@/lib/utils";

export type DisplayTimeTodoPopupItem = {
  id: string;
  title: string;
  description: string | null;
  priority: "high" | "medium" | "low";
  require_defer_reason: boolean;
  blocks_shift_end: boolean;
};

type DisplayTimeTodoPopupProps = {
  open: boolean;
  todo: DisplayTimeTodoPopupItem | null;
  trigger: StaffTodoDeferTrigger;
  blocksProceed: boolean;
  busy: boolean;
  onComplete: () => void;
  onDefer: (reason: string) => void;
};

export function DisplayTimeTodoPopup({
  open,
  todo,
  trigger,
  blocksProceed,
  busy,
  onComplete,
  onDefer,
}: DisplayTimeTodoPopupProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, todo?.id]);

  if (!todo) return null;

  const needsReason = todo.require_defer_reason;

  return (
    <Drawer open={open} direction="bottom" dismissible={false} modal>
      <DrawerContent className={drawerContentClassName("formMd")}>
        <DrawerHeader>
          <DrawerTitle>ToDo vor Schichtaktion</DrawerTitle>
          <DrawerDescription>
            Bitte erledigen oder verschieben, bevor Sie fortfahren.
          </DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-6 pb-6">
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{todo.title}</p>
              <Badge
                variant="outline"
                className={staffTodoPriorityBadgeClass(todo.priority)}
              >
                {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
              </Badge>
            </div>
            {todo.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{todo.description}</p>
            ) : null}
            {blocksProceed && trigger === "clock_out" ? (
              <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                Schichtende ist blockiert, bis dieses ToDo erledigt oder verschoben
                wurde.
              </p>
            ) : null}
          </div>

          {needsReason ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="defer-reason">
                Grund für Verschieben
              </label>
              <Input
                id="defer-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Kurz begründen …"
                className="h-12 rounded-xl"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              size="lg"
              className={cn("h-14 rounded-2xl text-base", brandActionButtonRoundedClassName)}
              disabled={busy}
              onClick={onComplete}
            >
              {busy ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <Check className="mr-2 size-5" />
              )}
              Erledigt
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-14 rounded-2xl text-base"
              disabled={busy || (needsReason && !reason.trim())}
              onClick={() => onDefer(reason.trim())}
            >
              Verschieben
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function useDisplayTimeTodoGate() {
  const [queue, setQueue] = useState<DisplayTimeTodoPopupItem[]>([]);
  const [trigger, setTrigger] = useState<StaffTodoDeferTrigger>("clock_in");
  const [blocksProceed, setBlocksProceed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolver, setResolver] = useState<
    ((result: "proceed" | "blocked") => void) | null
  >(null);

  const current = queue[0] ?? null;
  const open = queue.length > 0;

  const prepareAndGate = useCallback(
    async (
      displayAction: "clock_in" | "start_break" | "end_break" | "clock_out",
    ): Promise<"proceed" | "blocked"> => {
      const trig = displayActionToTrigger(displayAction);
      const res = await fetch("/api/display/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "prepare_trigger",
          display_action: displayAction,
        }),
      });
      if (!res.ok) {
        console.warn("[display] prepare_trigger failed", res.status);
        return "proceed";
      }
      const data = (await res.json()) as {
        todos?: DisplayTimeTodoPopupItem[];
        blocks?: boolean;
      };
      const todos = data.todos ?? [];
      if (todos.length === 0) return "proceed";

      return new Promise((resolve) => {
        setTrigger(trig);
        setBlocksProceed(Boolean(data.blocks));
        setQueue(todos);
        setResolver(() => resolve);
      });
    },
    [],
  );

  const finishGate = useCallback(
    (result: "proceed" | "blocked") => {
      setQueue([]);
      setBlocksProceed(false);
      resolver?.(result);
      setResolver(null);
    },
    [resolver],
  );

  const advanceOrFinish = useCallback(
    (blocked: boolean) => {
      setQueue((prev) => {
        const next = prev.slice(1);
        if (next.length === 0) {
          finishGate(blocked ? "blocked" : "proceed");
        }
        return next;
      });
    },
    [finishGate],
  );

  const handleComplete = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/display/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete", todo_id: current.id }),
      });
      if (!res.ok) {
        toast.error("Erledigen fehlgeschlagen.");
        return;
      }
      advanceOrFinish(false);
    } finally {
      setBusy(false);
    }
  }, [current, advanceOrFinish]);

  const handleDefer = useCallback(
    async (reason: string) => {
      if (!current) return;
      setBusy(true);
      try {
        const res = await fetch("/api/display/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "defer",
            todo_id: current.id,
            trigger,
            reason: reason || null,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(
            data.error === "reason_required"
              ? "Bitte einen Grund angeben."
              : "Verschieben fehlgeschlagen.",
          );
          return;
        }
        const blocked =
          blocksProceed && trigger === "clock_out" && current.blocks_shift_end;
        if (blocked) {
          finishGate("blocked");
          setQueue([]);
          return;
        }
        advanceOrFinish(false);
      } finally {
        setBusy(false);
      }
    },
    [current, trigger, blocksProceed, advanceOrFinish, finishGate],
  );

  return {
    prepareAndGate,
    popupProps: {
      open,
      todo: current,
      trigger,
      blocksProceed,
      busy,
      onComplete: () => void handleComplete(),
      onDefer: (reason: string) => void handleDefer(reason),
    },
  };
}
