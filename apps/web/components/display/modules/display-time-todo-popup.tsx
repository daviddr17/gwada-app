"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
  displayTodoCapturePanelClassName,
  DisplayTodoCapturePanelFooter,
  displayTodoCapturePayloadForTodo,
  displayTodoCaptureReadyForComplete,
  displayTodoShowsCaptureFieldsForTodo,
  effectiveCaptureTypeForTodo,
  type DisplayTodoCaptureState,
} from "@/components/display/display-todo-capture-fields";
import { DisplayTodoContextBadges } from "@/components/display/display-todo-context-badges";
import { DisplayTodoCapturedValue } from "@/components/display/display-todo-captured-value";
import type { DisplayTodoClient } from "@/lib/display/display-todo-client";
import { DisplayTodoGateCelebration, type DisplayTodoGateCelebrationVariant } from "@/components/display/display-celebration-overlay";
import { postDisplayTodoComplete, postDisplayTodoDefer } from "@/lib/display/display-todo-client";
import { displayTodoErrorMessage } from "@/lib/display/display-todo-errors";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import type { StaffTodoDeferTrigger } from "@/lib/types/staff-todos";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import { staffTodoPriorityBadgeClass } from "@/lib/staff/staff-todo-status";
import type { StaffTodoCapturePayload } from "@/lib/staff/staff-todo-capture";
import {
  resolveStaffTodoCaptureLimits,
  captureRequiresCorrectiveOnDeviation,
  evaluateStaffTodoCapture,
} from "@/lib/staff/staff-todo-capture";
import { displayActionToTrigger } from "@/lib/staff/staff-todo-display-triggers";
import {
  dispatchDisplayTodoBadgeSnapshot,
  dispatchDisplayTodosRefresh,
} from "@/lib/display/display-todos-live-events";
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
    todoId: string;
    completionNote: string | null;
    capturePayload: StaffTodoCapturePayload;
  }) => Promise<boolean>;
  onReopen: () => Promise<boolean>;
  onProceed: () => void;
  onDefer: (reason: string) => void;
  gateCelebration: DisplayTodoGateCelebrationVariant | null;
  beginGateCelebration: (
    variant: DisplayTodoGateCelebrationVariant,
    continueGate: () => void,
  ) => void;
  onGateCelebrationExitStart: () => void;
  onGateCelebrationDone: () => void;
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
  gateCelebration,
  beginGateCelebration,
  onGateCelebrationExitStart,
  onGateCelebrationDone,
}: DisplayTimeTodoPopupProps) {
  const [reason, setReason] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [capture, setCapture] = useState<DisplayTodoCaptureState>(
    EMPTY_DISPLAY_TODO_CAPTURE,
  );
  const [markedDone, setMarkedDone] = useState(false);
  const captureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReason(deferReasonDefault?.trim() ?? "");
    setCompletionNote("");
    setCapture(EMPTY_DISPLAY_TODO_CAPTURE);
    setMarkedDone(false);
  }, [todo?.id, deferReasonDefault]);

  useEffect(() => {
    if (!open || !todo) return;
    if (!displayTodoShowsCaptureFieldsForTodo(todo)) return;
    if (markedDone) return;
    const t = window.setTimeout(() => captureInputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open, todo?.id, todo, markedDone]);

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
  const description = isPinLogin
    ? "Erfassen, erledigen — oder auf die nächste Anmeldung verschieben."
    : "Erfassen und erledigen, dann fortfahren.";

  const canComplete = captureReady(todo, capture);
  const showCaptureFields = displayTodoShowsCaptureFieldsForTodo(todo);
  const completedCapturePayload = displayTodoCapturePayloadForTodo(todo, capture);
  const completedEvaluation = markedDone
    ? evaluateStaffTodoCapture(todo, completedCapturePayload)
    : null;

  const showProceed = markedDone;
  const showDefer = !markedDone;
  const deferDisabled =
    busy || (todo.require_defer_reason && !reason.trim());

  const handleMarkComplete = () => {
    if (!canComplete) return;
    setMarkedDone(true);
  };

  const handleMarkIncomplete = () => {
    setMarkedDone(false);
  };

  const handleProceedWithSave = () => {
    if (busy || gateCelebration) return;
    const capturePayload = displayTodoCapturePayloadForTodo(todo, capture);
    const evaluation = evaluateStaffTodoCapture(todo, capturePayload);
    if (!evaluation.ok) {
      toast.error(displayTodoErrorMessage(evaluation.error));
      return;
    }
    void onComplete({
      todoId: todo.id,
      completionNote: completionNote.trim() || null,
      capturePayload,
    })
      .then((ok) => {
        if (ok) {
          beginGateCelebration("todo_complete", onProceed);
        }
      })
      .catch(() => {
        toast.error(displayTodoErrorMessage("invalid_response"));
      });
  };

  const completeToggle = (
    <DisplayTodoCompleteToggle
      embedded={showCaptureFields || effectiveCaptureType === "boolean"}
      checked={markedDone}
      allowReopen={todo.allow_reopen_on_display}
      disabled={!canComplete && !markedDone}
      onMarkComplete={handleMarkComplete}
      onMarkIncomplete={handleMarkIncomplete}
    />
  );

  return (
    <>
    <Drawer open={open && !gateCelebration} direction="bottom" dismissible={false} modal>
      <DrawerContent className={drawerContentClassName("displayGate")}>
        <DrawerHeader className="space-y-1 p-0 pb-3 pt-1 text-center md:text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 px-6">
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {todo.title}
            </DrawerTitle>
            <Badge
              variant="outline"
              className={staffTodoPriorityBadgeClass(todo.priority)}
            >
              {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
            </Badge>
          </div>
          <DrawerDescription className="text-sm leading-relaxed">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[min(calc(92dvh-11rem),28rem)] space-y-4 overflow-y-auto overscroll-contain px-6 pb-4">
          <div className="space-y-3">
            <DisplayTodoContextBadges todo={todo} />
            {todo.description && !showCaptureFields && !markedDone ? (
              <p className="text-sm text-muted-foreground">{todo.description}</p>
            ) : null}
            {blocksProceed && trigger === "clock_out" ? (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Schichtende ist blockiert, bis diese Checkliste erledigt oder
                verschoben wurde.
              </p>
            ) : null}
          </div>

          {showCaptureFields && markedDone ? (
            <div
              className={displayTodoCapturePanelClassName({ done: true })}
            >
              <DisplayTodoCapturedValue
                plain
                captureType={effectiveCaptureType}
                targetMin={todo.target_min}
                targetMax={todo.target_max}
                checklistDevice={todo.checklist_device}
                capturedNumeric={completedEvaluation?.captured_numeric ?? null}
                capturedText={completedEvaluation?.captured_text ?? null}
                withinLimits={completedEvaluation?.within_limits ?? null}
                correctiveAction={completedEvaluation?.corrective_action ?? null}
                completionNote={completionNote.trim() || null}
              />
              <DisplayTodoCapturePanelFooter>{completeToggle}</DisplayTodoCapturePanelFooter>
            </div>
          ) : null}

          {showCaptureFields && !markedDone ? (
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
              panelFooter={completeToggle}
            />
          ) : null}

          {!markedDone && todo.require_defer_reason ? (
            <div className="space-y-1.5">
              <Label htmlFor="defer-reason">Grund für Verschieben</Label>
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
              <Label htmlFor="todo-completion-note">Notiz (optional)</Label>
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

          {!showCaptureFields && effectiveCaptureType === "boolean" ? (
            <div
              className={displayTodoCapturePanelClassName({
                done: markedDone,
              })}
            >
              {completeToggle}
            </div>
          ) : null}

          {!showCaptureFields && effectiveCaptureType !== "boolean" ? (
            <DisplayTodoCompleteToggle
              checked={markedDone}
              allowReopen={todo.allow_reopen_on_display}
              disabled={!canComplete && !markedDone}
              onMarkComplete={handleMarkComplete}
              onMarkIncomplete={handleMarkIncomplete}
            />
          ) : null}
        </div>

        {(showProceed || showDefer) && (
          <div
            className={cn(
              "shrink-0 space-y-2 border-t border-border/40 px-6 pt-3",
              "pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]",
            )}
          >
            {showProceed ? (
              <Button
                type="button"
                size="lg"
                className={cn(
                  "h-14 w-full rounded-2xl text-base",
                  brandActionButtonRoundedClassName,
                )}
                disabled={busy}
                onClick={handleProceedWithSave}
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : null}
                Fortfahren
              </Button>
            ) : null}
            {showDefer ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-2xl text-base"
                disabled={deferDisabled}
                onClick={() => onDefer(reason.trim())}
              >
                Verschieben
              </Button>
            ) : null}
          </div>
        )}
      </DrawerContent>
    </Drawer>
    <DisplayTodoGateCelebration
      variant={gateCelebration}
      onExitStart={onGateCelebrationExitStart}
      onDone={onGateCelebrationDone}
    />
    </>
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
  const [gateCelebration, setGateCelebration] =
    useState<DisplayTodoGateCelebrationVariant | null>(null);
  const pendingGateContinueRef = useRef<(() => void) | null>(null);

  const current = queue[0] ?? null;
  const open = queue.length > 0;
  const queueRef = useRef(queue);
  queueRef.current = queue;

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
      setBusy(false);
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
      setBusy(false);
      setQueue((prev) => {
        const next = prev.slice(1);
        if (next.length === 0) {
          queueMicrotask(() => {
            setBlocksProceed(false);
            if (resolver) {
              finishGate(blocked ? "blocked" : "proceed");
            } else {
              pinResolver?.();
              setPinResolver(null);
            }
          });
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
        if (queueRef.current.length > 0) {
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

  const beginGateCelebration = useCallback(
    (variant: DisplayTodoGateCelebrationVariant, continueGate: () => void) => {
      pendingGateContinueRef.current = continueGate;
      setGateCelebration(variant);
    },
    [],
  );

  const onGateCelebrationExitStart = useCallback(() => {
    /* Fortschritt erst in onDone — Queue bleibt während der Animation stabil. */
  }, []);

  const onGateCelebrationDone = useCallback(() => {
    pendingGateContinueRef.current?.();
    pendingGateContinueRef.current = null;
    setGateCelebration(null);
  }, []);

  const handleComplete = useCallback(
    async (payload: {
      todoId: string;
      completionNote: string | null;
      capturePayload: StaffTodoCapturePayload;
    }): Promise<boolean> => {
      if (!payload.todoId) {
        toast.error("Checkliste nicht gefunden.");
        return false;
      }
      setBusy(true);
      try {
        const result = await postDisplayTodoComplete(payload.todoId, {
          completionNote: payload.completionNote,
          capture: payload.capturePayload,
        });
        if (!result.ok) {
          toast.error(displayTodoErrorMessage(result.error));
          setBusy(false);
          return false;
        }
        dispatchDisplayTodoBadgeSnapshot({
          badge_count: result.badge_count,
          badge_urgency: result.badge_urgency,
          guardRefresh: true,
        });
        setBusy(false);
        return true;
      } catch {
        toast.error(displayTodoErrorMessage("invalid_response"));
        setBusy(false);
        return false;
      }
    },
    [],
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
        const result = await postDisplayTodoDefer(current.id, {
          trigger,
          reason: reason || null,
        });
        if (!result.ok) {
          toast.error(displayTodoErrorMessage(result.error));
          setBusy(false);
          return;
        }
        const blocked =
          blocksProceed && trigger === "clock_out" && current.blocks_shift_end;
        if (blocked) {
          finishGate("blocked");
          setQueue([]);
          return;
        }
        dispatchDisplayTodoBadgeSnapshot({
          badge_count: result.badge_count,
          badge_urgency: result.badge_urgency,
          guardRefresh: true,
        });
        beginGateCelebration("todo_defer", () => advanceOrFinish(false));
      } catch {
        setBusy(false);
      }
    },
    [
      current,
      trigger,
      blocksProceed,
      advanceOrFinish,
      finishGate,
      beginGateCelebration,
    ],
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
      gateCelebration,
      beginGateCelebration,
      onGateCelebrationExitStart,
      onGateCelebrationDone,
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
