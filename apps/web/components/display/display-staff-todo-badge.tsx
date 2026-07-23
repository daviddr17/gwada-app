"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTodo, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  buildStaffTodoLimitsLabel,
  type DisplayTodoCaptureState,
} from "@/components/display/display-todo-capture-fields";
import { DisplayTodoContextBadges } from "@/components/display/display-todo-context-badges";
import { DisplayTodoCapturedValue } from "@/components/display/display-todo-captured-value";
import type { DisplayTodoClient } from "@/lib/display/display-todo-client";
import { postDisplayTodoComplete } from "@/lib/display/display-todo-client";
import { displayTodoErrorMessage } from "@/lib/display/display-todo-errors";
import { handleDisplaySessionAuthFailure } from "@/lib/display/display-session-client";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import {
  staffTodoPriorityBadgeClass,
  staffTodoStatusBadgeClass,
  STAFF_TODO_STATUS_LABELS,
} from "@/lib/staff/staff-todo-status";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";
import {
  GWADA_DISPLAY_TODOS_REFRESH_EVENT,
  dispatchDisplayTodoBadgeSnapshot,
  dispatchDisplayTodosRefresh,
} from "@/lib/display/display-todos-live-events";
import {
  DISPLAY_CHECKLIST_FOOTER_LABEL,
  DISPLAY_CHECKLIST_OPEN_LABEL,
} from "@/lib/display/display-checklist-copy";
import {
  displayTodoFooterCountClassName,
  displayTodoFooterIconClassName,
  displayTodoFooterTriggerClassName,
} from "@/lib/ui/display-todo-footer-trigger";
import {
  resolveStaffTodoCaptureLimits,
  captureRequiresCorrectiveOnDeviation,
  evaluateStaffTodoCapture,
} from "@/lib/staff/staff-todo-capture";
import { cn } from "@/lib/utils";

type DisplayStaffTodoBadgeProps = {
  count: number;
  urgency?: StaffTodoDisplayUrgency;
  onChanged?: () => void;
};

function captureReady(todo: DisplayTodoClient, capture: DisplayTodoCaptureState): boolean {
  return displayTodoCaptureReadyForComplete(todo, capture);
}

function DisplayTodoCard({
  todo,
  busy,
  disabled,
  onComplete,
  onReopen,
}: {
  todo: DisplayTodoClient;
  busy: boolean;
  disabled: boolean;
  onComplete: (capture: DisplayTodoCaptureState, note: string | null) => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  const [capture, setCapture] = useState<DisplayTodoCaptureState>(
    EMPTY_DISPLAY_TODO_CAPTURE,
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    setCapture(EMPTY_DISPLAY_TODO_CAPTURE);
    setNote("");
  }, [todo.id, todo.done_for_staff]);

  const limits = useMemo(() => resolveStaffTodoCaptureLimits(todo), [todo]);
  const effectiveCaptureType = effectiveCaptureTypeForTodo(todo);
  const showCaptureFields = displayTodoShowsCaptureFieldsForTodo(todo);
  const correctiveRequired = captureRequiresCorrectiveOnDeviation(todo, limits);

  const canComplete = captureReady(todo, capture);

  const completeToggle = (
    <DisplayTodoCompleteToggle
      embedded={showCaptureFields || effectiveCaptureType === "boolean"}
      checked={todo.done_for_staff}
      allowReopen={todo.allow_reopen_on_display}
      busy={busy}
      disabled={disabled || (!canComplete && !todo.done_for_staff)}
      onMarkComplete={() => void onComplete(capture, note.trim() || null)}
      onMarkIncomplete={() => void onReopen()}
    />
  );

  return (
    <div className="rounded-2xl border border-border/50 bg-muted/15 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="font-medium">{todo.title}</p>
        <Badge variant="outline" className={staffTodoPriorityBadgeClass(todo.priority)}>
          {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
        </Badge>
        <Badge
          variant="outline"
          className={staffTodoStatusBadgeClass(
            todo.done_for_staff ? "done" : todo.status,
          )}
        >
          {STAFF_TODO_STATUS_LABELS[todo.done_for_staff ? "done" : todo.status]}
        </Badge>
      </div>
      <DisplayTodoContextBadges todo={todo} className="mb-2" />
      {todo.description && !showCaptureFields ? (
        <p className="mb-3 text-sm text-muted-foreground">{todo.description}</p>
      ) : null}

      {todo.done_for_staff && showCaptureFields ? (
        <div
          className={cn(
            "mb-3",
            displayTodoCapturePanelClassName({ done: true }),
          )}
        >
          <DisplayTodoCapturedValue
            plain
            captureType={todo.capture_type}
            targetMin={todo.target_min}
            targetMax={todo.target_max}
            checklistDevice={todo.checklist_device}
            capturedNumeric={todo.captured_numeric}
            capturedText={todo.captured_text}
            withinLimits={todo.within_limits}
            correctiveAction={todo.corrective_action}
            completionNote={todo.completion_note}
          />
          <DisplayTodoCapturePanelFooter>{completeToggle}</DisplayTodoCapturePanelFooter>
        </div>
      ) : null}

      {!todo.done_for_staff && (showCaptureFields || effectiveCaptureType === "boolean") ? (
        <div className="mb-3 space-y-3">
          {showCaptureFields ? (
            <DisplayTodoCaptureFields
              captureType={effectiveCaptureType}
              limits={limits}
              limitsLabel={buildStaffTodoLimitsLabel(todo)}
              values={capture}
              onChange={setCapture}
              correctiveRequired={correctiveRequired}
              variant="display"
              panelFooter={completeToggle}
            />
          ) : (
            <div
              className={displayTodoCapturePanelClassName({
                done: todo.done_for_staff,
              })}
            >
              {completeToggle}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`todo-note-${todo.id}`}>Notiz (optional)</Label>
            <Textarea
              id={`todo-note-${todo.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>
        </div>
      ) : null}

      {todo.done_for_staff && !showCaptureFields && effectiveCaptureType === "boolean" ? (
        <div
          className={cn("mb-3", displayTodoCapturePanelClassName({ done: true }))}
        >
          {completeToggle}
        </div>
      ) : null}

      {!todo.done_for_staff && !showCaptureFields && effectiveCaptureType !== "boolean" ? (
        completeToggle
      ) : null}

      {todo.done_for_staff &&
      !showCaptureFields &&
      effectiveCaptureType !== "boolean" ? (
        <>
          <DisplayTodoCapturedValue
            className="mb-3"
            captureType={todo.capture_type}
            targetMin={todo.target_min}
            targetMax={todo.target_max}
            checklistDevice={todo.checklist_device}
            capturedNumeric={todo.captured_numeric}
            capturedText={todo.captured_text}
            withinLimits={todo.within_limits}
            correctiveAction={todo.corrective_action}
            completionNote={todo.completion_note}
          />
          {completeToggle}
        </>
      ) : null}
    </div>
  );
}

export function DisplayStaffTodoBadge({
  count,
  urgency = "green",
  onChanged,
}: DisplayStaffTodoBadgeProps) {
  const [open, setOpen] = useState(false);
  const [todos, setTodos] = useState<DisplayTodoClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOpenTodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/display/todos", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        if (await handleDisplaySessionAuthFailure(res)) {
          setTodos([]);
          return;
        }
        toast.error("Checklisten konnten nicht geladen werden.");
        setTodos([]);
        return;
      }
      const data = (await res.json()) as { todos?: DisplayTodoClient[] };
      setTodos(data.todos ?? []);
    } catch {
      toast.error("ToDos konnten nicht geladen werden.");
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadOpenTodos();
  }, [open, loadOpenTodos]);

  useEffect(() => {
    if (!open) return;
    const onRefresh = () => void loadOpenTodos();
    window.addEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
  }, [open, loadOpenTodos]);

  const patchTodo = (todoId: string, patch: Partial<DisplayTodoClient>) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, ...patch } : t)),
    );
  };

  const handleComplete = async (
    todo: DisplayTodoClient,
    capture: DisplayTodoCaptureState,
    note: string | null,
  ) => {
    setBusyId(todo.id);
    try {
      const capturePayload = displayTodoCapturePayloadForTodo(todo, capture);
      const result = await postDisplayTodoComplete(todo.id, {
        completionNote: note,
        capture: capturePayload,
      });
      if (!result.ok) {
        toast.error(displayTodoErrorMessage(result.error));
        return;
      }
      toast.success("Checkliste erledigt.");
      dispatchDisplayTodoBadgeSnapshot({
        badge_count: result.badge_count,
        badge_urgency: result.badge_urgency,
        guardRefresh: true,
      });
      onChanged?.();
      const evaluation = evaluateStaffTodoCapture(todo, capturePayload);
      if (todo.allow_reopen_on_display) {
        patchTodo(todo.id, {
          done_for_staff: true,
          status: "done",
          captured_numeric: evaluation.captured_numeric,
          captured_text: evaluation.captured_text,
          completion_note: note,
          within_limits: evaluation.within_limits,
          corrective_action: evaluation.corrective_action,
        });
      } else {
        const next = todos.filter((t) => t.id !== todo.id);
        setTodos(next);
        if (next.length === 0) setOpen(false);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleReopen = async (todo: DisplayTodoClient) => {
    setBusyId(todo.id);
    try {
      const res = await fetch("/api/display/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "reopen", todo_id: todo.id }),
      });
      if (!res.ok) {
        toast.error("Zurücknehmen fehlgeschlagen.");
        return;
      }
      toast.success("Checkliste wieder geöffnet.");
      dispatchDisplayTodosRefresh();
      onChanged?.();
      patchTodo(todo.id, { done_for_staff: false, status: "open",
        captured_numeric: null,
        captured_text: null,
        completion_note: null,
        within_limits: null,
        corrective_action: null,
      });
    } finally {
      setBusyId(null);
    }
  };

  if (count <= 0) return null;

  const countLabel = count > 9 ? "9+" : String(count);

  return (
    <>
      <button
        type="button"
        className={displayTodoFooterTriggerClassName(urgency)}
        aria-label={`${count} offene Checklisten — tippen zum Erledigen`}
        onClick={() => setOpen(true)}
      >
        <ListTodo className={displayTodoFooterIconClassName(urgency)} aria-hidden />
        <span className="text-xs font-medium tracking-tight text-foreground/85">
          {DISPLAY_CHECKLIST_FOOTER_LABEL}
        </span>
        <span className={displayTodoFooterCountClassName(urgency)} aria-hidden>
          {countLabel}
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen} direction="bottom">
        <DrawerContent className={drawerContentClassName("formMd")}>
          <DrawerHeader>
            <DrawerTitle>{DISPLAY_CHECKLIST_OPEN_LABEL}</DrawerTitle>
            <DrawerDescription>
              Erfassung ausfüllen und als erledigt markieren — bei erlaubten
              Checklisten wieder zurücknehmbar.
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[min(60dvh,420px)] space-y-3 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : todos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Keine offenen Checklisten.
              </p>
            ) : (
              todos.map((todo) => (
                <DisplayTodoCard
                  key={todo.id}
                  todo={todo}
                  busy={busyId === todo.id}
                  disabled={busyId != null && busyId !== todo.id}
                  onComplete={(capture, note) => handleComplete(todo, capture, note)}
                  onReopen={() => handleReopen(todo)}
                />
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
