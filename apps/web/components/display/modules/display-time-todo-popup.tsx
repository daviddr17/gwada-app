"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DisplayTodoCompleteToggle } from "@/components/display/display-todo-complete-toggle";
import {
  DisplayTodoCaptureFields,
  EMPTY_DISPLAY_TODO_CAPTURE,
  displayTodoCapturePayloadForTodo,
  displayTodoCaptureReadyForComplete,
  displayTodoShowsCaptureFieldsForTodo,
  effectiveCaptureTypeForTodo,
  type DisplayTodoCaptureState,
} from "@/components/display/display-todo-capture-fields";
import { DisplayTodoContextBadges } from "@/components/display/display-todo-context-badges";
import { DisplayTodoCapturedValue } from "@/components/display/display-todo-captured-value";
import type { DisplayTodoClient } from "@/lib/display/display-todo-client";
import { postDisplayTodoComplete } from "@/lib/display/display-todo-client";
import { displayTodoErrorMessage } from "@/lib/display/display-todo-errors";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import { staffTodoPriorityBadgeClass } from "@/lib/staff/staff-todo-status";
import {
  resolveStaffTodoCaptureLimits,
  captureRequiresCorrectiveOnDeviation,
  evaluateStaffTodoCapture,
} from "@/lib/staff/staff-todo-capture";
import { displayActionToTrigger } from "@/lib/staff/staff-todo-display-triggers";
import { dispatchDisplayTodosRefresh } from "@/lib/display/display-todos-live-events";
import { buildStaffTodoLimitsLabel } from "@/components/display/display-todo-capture-fields";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export type DisplayTimeTodoPopupItem = DisplayTodoClient;

type DisplayTimeTodoPopupProps = {
  open: boolean;
  todo: DisplayTimeTodoPopupItem | null;
  trigger: StaffTodoDeferTrigger;
  blocksProceed: boolean;
  busy: boolean;
  deferReasonDefault?: string | null;
  onComplete: (payload: {
    completionNote: string | null;
    capture: DisplayTodoCaptureState;
  }) => Promise<boolean>;
  onReopen: () => Promise<boolean>;
  onProceed: () => void;
  onDefer: (reason: string) => void;
};

function captureReady(
  todo: DisplayTimeTodoPopupItem,
  capture: DisplayTodoCaptureState,
): boolean {
  return displayTodoCaptureReadyForComplete(todo, capture);
}

export function DisplayTimeTodoPopup({
  open,
  todo,
  trigger,
  blocksProceed,
  busy,
  deferReasonDefault,
  onComplete,
  onReopen,
  onProceed,
  onDefer,
}: DisplayTimeTodoPopupProps) {
  const [reason, setReason] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [capture, setCapture] = useState<DisplayTodoCaptureState>(
    EMPTY_DISPLAY_TODO_CAPTURE,
  );
  const [markedDone, setMarkedDone] = useState(false);
  const captureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setReason(deferReasonDefault?.trim() ?? "");
      setCompletionNote("");
      setCapture(EMPTY_DISPLAY_TODO_CAPTURE);
      setMarkedDone(false);
    }
  }, [open, todo?.id, deferReasonDefault]);

  useEffect(() => {
    if (!open || !todo) return;
    if (!displayTodoShowsCaptureFieldsForTodo(todo)) return;
    const t = window.setTimeout(() => captureInputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open, todo?.id, todo]);

  const limits = useMemo(
    () => (todo ? resolveStaffTodoCaptureLimits(todo) : { min: null, max: null }),
    [todo],
  );

  const effectiveCaptureType = todo
    ? effectiveCaptureTypeForTodo(todo)
    : ("none" as const);

  const correctiveRequired = todo
    ? captureRequiresCorrectiveOnDeviation(todo, limits)
    : false;

  if (!todo) return null;

  const isPinLogin = trigger === "pin_login";
  const title = isPinLogin ? "Checkliste bei Anmeldung" : "Checkliste vor Schichtaktion";
  const description = isPinLogin
    ? "Bitte erfassen oder erledigen, oder auf die nächste Anmeldung verschieben."
    : "Bitte erfassen oder erledigen, bevor Sie fortfahren.";

  const canComplete = captureReady(todo, capture);
  const showCaptureFields = displayTodoShowsCaptureFieldsForTodo(todo);
  const completedCapturePayload = displayTodoCapturePayloadForTodo(todo, capture);
  const completedEvaluation = markedDone
    ? evaluateStaffTodoCapture(todo, completedCapturePayload)
    : null;

  return (
    <Drawer open={open} direction="bottom" dismissible={false} modal>
      <DrawerContent className={drawerContentClassName("formMd")}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-1">
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
              <DisplayTodoContextBadges todo={todo} className="mt-2" />
              {todo.description && !showCaptureFields ? (
                <p className="mt-2 text-sm text-muted-foreground">{todo.description}</p>
              ) : null}
              {blocksProceed && trigger === "clock_out" ? (
                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                  Schichtende ist blockiert, bis diese Checkliste erledigt oder
                  verschoben wurde.
                </p>
              ) : null}

              {showCaptureFields && markedDone ? (
                <div className="mt-4">
                  <DisplayTodoCapturedValue
                    captureType={effectiveCaptureType}
                    targetMin={todo.target_min}
                    targetMax={todo.target_max}
                    checklistDevice={todo.checklist_device}
                    capturedNumeric={completedCapturePayload.captured_numeric ?? null}
                    capturedText={completedCapturePayload.captured_text ?? null}
                    withinLimits={completedEvaluation?.within_limits ?? null}
                    correctiveAction={completedCapturePayload.corrective_action ?? null}
                    completionNote={completionNote.trim() || null}
                  />
                </div>
              ) : null}

              {showCaptureFields && !markedDone ? (
                <div className="mt-4">
                  <DisplayTodoCaptureFields
                    captureType={effectiveCaptureType}
                    limits={limits}
                    limitsLabel={buildStaffTodoLimitsLabel(todo)}
                    values={capture}
                    onChange={setCapture}
                    correctiveRequired={correctiveRequired}
                    variant="display"
                    autoFocus
                    inputRef={captureInputRef}
                  />
                </div>
              ) : null}
            </div>

            {!markedDone && todo.require_defer_reason ? (
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

            {!markedDone ? (
              <div className="space-y-1.5">
                <Label htmlFor="todo-completion-note">Notiz bei Erledigung (optional)</Label>
                <Textarea
                  id="todo-completion-note"
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  rows={2}
                  placeholder="Optional …"
                  className="rounded-xl"
                />
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-3 border-t border-border/20 px-6 py-4">
            <DisplayTodoCompleteToggle
              checked={markedDone}
              allowReopen={todo.allow_reopen_on_display}
              busy={busy}
              disabled={!canComplete && !markedDone}
              onMarkComplete={() => {
                void onComplete({
                  completionNote: completionNote.trim() || null,
                  capture,
                }).then((ok) => {
                  if (ok) setMarkedDone(true);
                });
              }}
              onMarkIncomplete={() => {
                void onReopen().then((ok) => {
                  if (ok) setMarkedDone(false);
                });
              }}
            />
            {todo.allow_reopen_on_display && markedDone ? (
              <Button
                type="button"
                size="lg"
                className={cn("h-14 rounded-2xl text-base", brandActionButtonRoundedClassName)}
                disabled={busy}
                onClick={onProceed}
              >
                Fortfahren
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-14 rounded-2xl text-base"
              disabled={busy || (todo.require_defer_reason && !reason.trim())}
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
  const [deferReasonDefault, setDeferReasonDefault] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<StaffTodoDeferTrigger>("clock_in");
  const [blocksProceed, setBlocksProceed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolver, setResolver] = useState<
    ((result: "proceed" | "blocked") => void) | null
  >(null);
  const [pinResolver, setPinResolver] = useState<(() => void) | null>(null);

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
        toast.error(
          "Checklisten konnten nicht geladen werden. Schichtaktion abgebrochen.",
        );
        return "blocked";
      }
      const data = (await res.json()) as {
        todos?: DisplayTimeTodoPopupItem[];
        blocks?: boolean;
        defer_reason_default?: string | null;
      };
      const todos = data.todos ?? [];
      if (todos.length === 0) return "proceed";

      return new Promise((resolve) => {
        setTrigger(trig);
        setBlocksProceed(Boolean(data.blocks));
        setDeferReasonDefault(data.defer_reason_default ?? null);
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
      pinResolver?.();
      setPinResolver(null);
    },
    [resolver, pinResolver],
  );

  const advanceOrFinish = useCallback(
    (blocked: boolean) => {
      setQueue((prev) => {
        const next = prev.slice(1);
        if (next.length === 0) {
          setBlocksProceed(false);
          if (resolver) {
            finishGate(blocked ? "blocked" : "proceed");
          } else {
            pinResolver?.();
            setPinResolver(null);
          }
        }
        return next;
      });
    },
    [finishGate, resolver, pinResolver],
  );

  const preparePinLoginGateAsync = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      void (async () => {
        const res = await fetch("/api/display/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "prepare_pin_login" }),
        });
        if (!res.ok) {
          console.warn("[display] prepare_pin_login failed", res.status);
          toast.error("Checklisten konnten nicht geladen werden.");
          resolve();
          return;
        }
        const data = (await res.json()) as {
          todos?: DisplayTimeTodoPopupItem[];
          defer_reason_default?: string | null;
        };
        const todos = data.todos ?? [];
        if (todos.length === 0) {
          resolve();
          return;
        }
        setTrigger("pin_login");
        setBlocksProceed(false);
        setDeferReasonDefault(data.defer_reason_default ?? null);
        setResolver(null);
        setPinResolver(() => resolve);
        setQueue(todos);
      })();
    });
  }, []);

  const preparePinLoginGate = useCallback(async () => {
    await preparePinLoginGateAsync();
  }, [preparePinLoginGateAsync]);

  const handleComplete = useCallback(
    async (payload: {
      completionNote: string | null;
      capture: DisplayTodoCaptureState;
    }): Promise<boolean> => {
      if (!current) return false;
      setBusy(true);
      try {
        const capturePayload = displayTodoCapturePayloadForTodo(
          current,
          payload.capture,
        );
        const result = await postDisplayTodoComplete(current.id, {
          completionNote: payload.completionNote,
          capture: capturePayload,
        });
        if (!result.ok) {
          toast.error(displayTodoErrorMessage(result.error));
          return false;
        }
        dispatchDisplayTodosRefresh();
        if (!current.allow_reopen_on_display) {
          advanceOrFinish(false);
        }
        return true;
      } finally {
        setBusy(false);
      }
    },
    [current, advanceOrFinish],
  );

  const handleReopen = useCallback(async (): Promise<boolean> => {
    if (!current) return false;
    setBusy(true);
    try {
      const res = await fetch("/api/display/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "reopen", todo_id: current.id }),
      });
      if (!res.ok) {
        toast.error("Zurücknehmen fehlgeschlagen.");
        return false;
      }
      dispatchDisplayTodosRefresh();
      return true;
    } finally {
      setBusy(false);
    }
  }, [current]);

  const handleProceed = useCallback(() => {
    advanceOrFinish(false);
  }, [advanceOrFinish]);

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
          toast.error(displayTodoErrorMessage(data.error));
          return;
        }
        const blocked =
          blocksProceed && trigger === "clock_out" && current.blocks_shift_end;
        if (blocked) {
          finishGate("blocked");
          setQueue([]);
          return;
        }
        dispatchDisplayTodosRefresh();
        advanceOrFinish(false);
      } finally {
        setBusy(false);
      }
    },
    [current, trigger, blocksProceed, advanceOrFinish, finishGate],
  );

  return {
    prepareAndGate,
    preparePinLoginGate,
    preparePinLoginGateAsync,
    popupProps: {
      open,
      todo: current,
      trigger,
      blocksProceed,
      busy,
      deferReasonDefault,
      onComplete: handleComplete,
      onReopen: handleReopen,
      onProceed: handleProceed,
      onDefer: (reason: string) => void handleDefer(reason),
    },
  };
}

export type DisplayShiftGateAction =
  | "clock_in"
  | "start_break"
  | "end_break"
  | "clock_out";

export type DisplayPrepareAndGate = (
  displayAction: DisplayShiftGateAction,
) => Promise<"proceed" | "blocked">;
