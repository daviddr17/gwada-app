"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  DisplayTodoCaptureFields,
  EMPTY_DISPLAY_TODO_CAPTURE,
  displayTodoCapturePayloadForComplete,
  displayTodoShowsCaptureFields,
  buildStaffTodoLimitsLabel,
  type DisplayTodoCaptureState,
} from "@/components/display/display-todo-capture-fields";
import { DisplayTodoContextBadges } from "@/components/display/display-todo-context-badges";
import {
  type DisplayTodoClient,
  isDisplayChecklistTodo,
  postDisplayTodoComplete,
} from "@/lib/display/display-todo-client";
import { displayTodoErrorMessage } from "@/lib/display/display-todo-errors";
import { GWADA_DISPLAY_TODOS_REFRESH_EVENT, dispatchDisplayTodosRefresh } from "@/lib/display/display-todos-live-events";
import { staffTodoCaptureLabel, staffTodoRecurrenceLabel } from "@/lib/staff/staff-todo-meta";
import {
  evaluateStaffTodoCapture,
  resolveStaffTodoCaptureLimits,
} from "@/lib/staff/staff-todo-capture";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export function DisplayComplianceModule() {
  const [todos, setTodos] = useState<DisplayTodoClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<DisplayTodoClient | null>(null);
  const [capture, setCapture] = useState<DisplayTodoCaptureState>(
    EMPTY_DISPLAY_TODO_CAPTURE,
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/display/todos", { credentials: "include" });
      const json = (await res.json()) as {
        todos?: DisplayTodoClient[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Laden fehlgeschlagen");
        setTodos([]);
      } else {
        setTodos(
          (json.todos ?? []).filter(
            (t) => isDisplayChecklistTodo(t) && !t.done_for_staff,
          ),
        );
      }
    } catch {
      toast.error("Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onRefresh = () => void reload();
    window.addEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(GWADA_DISPLAY_TODOS_REFRESH_EVENT, onRefresh);
  }, [reload]);

  const limits = useMemo(
    () => (active ? resolveStaffTodoCaptureLimits(active) : { min: null, max: null }),
    [active],
  );

  const captureEvaluation = useMemo(() => {
    if (!active) return null;
    const payload = displayTodoCapturePayloadForComplete(active.capture_type, capture);
    return evaluateStaffTodoCapture(active, payload);
  }, [active, capture]);

  const showCorrective = Boolean(
    captureEvaluation?.has_deviation && active?.require_corrective_on_deviation,
  );

  const openTodo = (todo: DisplayTodoClient) => {
    setActive(todo);
    setCapture(EMPTY_DISPLAY_TODO_CAPTURE);
    setNotes("");
  };

  const save = async () => {
    if (!active) return;
    const capturePayload = displayTodoCapturePayloadForComplete(
      active.capture_type,
      capture,
    );
    const evaluation = evaluateStaffTodoCapture(active, capturePayload);
    if (!evaluation.ok) {
      toast.error(displayTodoErrorMessage(evaluation.error));
      return;
    }

    setSaving(true);
    try {
      const result = await postDisplayTodoComplete(active.id, {
        completionNote: notes.trim() || null,
        capture: capturePayload,
      });
      if (!result.ok) {
        toast.error(displayTodoErrorMessage(result.error));
        return;
      }
      toast.success(
        evaluation.has_deviation
          ? "Eintrag mit Abweichung gespeichert."
          : "Eintrag gespeichert.",
      );
      setActive(null);
      dispatchDisplayTodosRefresh();
      void reload();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={displayModuleContentClassName}>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (active) {
    return (
      <div className={cn(displayModuleContentClassName, "space-y-4")}>
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl px-0"
          onClick={() => setActive(null)}
        >
          ← Zurück
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{active.title}</h2>
          {active.description?.trim() ? (
            <p className="mt-1 text-sm text-muted-foreground">{active.description}</p>
          ) : null}
          <DisplayTodoContextBadges todo={active} className="mt-2" />
        </div>
        <DisplayTodoCaptureFields
          captureType={active.capture_type}
          limits={limits}
          limitsLabel={buildStaffTodoLimitsLabel(active)}
          values={capture}
          onChange={setCapture}
          showCorrective={showCorrective}
          large
        />
        {active.capture_type === "boolean" ? (
          <p className="text-sm text-muted-foreground">
            Mit „Eintrag speichern“ bestätigen Sie, dass der Punkt erledigt ist.
          </p>
        ) : null}
        <div className="space-y-2">
          <Label>Notiz (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-2xl text-base"
          />
        </div>
        <Button
          type="button"
          size="lg"
          className={cn("h-14 w-full text-base", brandActionButtonRoundedClassName)}
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Speichern …" : "Eintrag speichern"}
        </Button>
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className={displayModuleContentClassName}>
        <p className="text-center text-muted-foreground">
          Keine offenen Checklisten — legen Sie Einträge unter Checklisten an
          und aktivieren Sie „Am Display anzeigen“.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(displayModuleContentClassName, "space-y-3")}>
      {todos.map((todo) => {
        const recurrence = staffTodoRecurrenceLabel(todo.recurrence);
        const captureLabel = staffTodoCaptureLabel(todo.capture_type);
        const context =
          [todo.checklist_area?.name, todo.checklist_device?.name]
            .filter(Boolean)
            .join(" · ") || null;

        return (
          <button
            key={todo.id}
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20 active:scale-[0.99]"
            onClick={() => openTodo(todo)}
          >
            <ClipboardCheck className="size-6 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{todo.title}</p>
              <p className="text-sm text-muted-foreground">
                {[recurrence, captureLabel, context].filter(Boolean).join(" · ")}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}
