"use client";

import { useCallback, useEffect, useState } from "react";
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
import { DisplayTodoCompleteToggle } from "@/components/display/display-todo-complete-toggle";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  STAFF_TODO_PRIORITY_LABELS,
  type StaffTodoPriority,
  type StaffTodoComputedStatus,
} from "@/lib/types/staff-todos";
import {
  staffTodoPriorityBadgeClass,
  staffTodoStatusBadgeClass,
  STAFF_TODO_STATUS_LABELS,
} from "@/lib/staff/staff-todo-status";
import type { StaffTodoDisplayUrgency } from "@/lib/staff/staff-todo-status";
import { GWADA_DISPLAY_TODOS_REFRESH_EVENT } from "@/lib/display/display-todos-live-events";
import {
  displayTodoFooterCountClassName,
  displayTodoFooterIconClassName,
  displayTodoFooterTriggerClassName,
} from "@/lib/ui/display-todo-footer-trigger";

type DisplayOpenTodo = {
  id: string;
  title: string;
  description: string | null;
  priority: StaffTodoPriority;
  status: StaffTodoComputedStatus;
  allow_reopen_on_display: boolean;
  done_for_staff: boolean;
};

type DisplayStaffTodoBadgeProps = {
  count: number;
  urgency?: StaffTodoDisplayUrgency;
  onChanged?: () => void;
};

export function DisplayStaffTodoBadge({
  count,
  urgency = "green",
  onChanged,
}: DisplayStaffTodoBadgeProps) {
  const [open, setOpen] = useState(false);
  const [todos, setTodos] = useState<DisplayOpenTodo[]>([]);
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
        toast.error("ToDos konnten nicht geladen werden.");
        setTodos([]);
        return;
      }
      const data = (await res.json()) as {
        todos?: DisplayOpenTodo[];
      };
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

  const patchTodo = (todoId: string, patch: Partial<DisplayOpenTodo>) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, ...patch } : t)),
    );
  };

  const handleComplete = async (todo: DisplayOpenTodo) => {
    setBusyId(todo.id);
    try {
      const res = await fetch("/api/display/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete", todo_id: todo.id }),
      });
      if (!res.ok) {
        toast.error("Erledigen fehlgeschlagen.");
        return;
      }
      toast.success("ToDo erledigt.");
      onChanged?.();
      if (todo.allow_reopen_on_display) {
        patchTodo(todo.id, { done_for_staff: true, status: "done" });
      } else {
        const next = todos.filter((t) => t.id !== todo.id);
        setTodos(next);
        if (next.length === 0) setOpen(false);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleReopen = async (todo: DisplayOpenTodo) => {
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
      toast.success("ToDo wieder geöffnet.");
      onChanged?.();
      patchTodo(todo.id, { done_for_staff: false, status: "open" });
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
        aria-label={`${count} offene ToDos — tippen zum Erledigen`}
        onClick={() => setOpen(true)}
      >
        <ListTodo className={displayTodoFooterIconClassName(urgency)} aria-hidden />
        <span className="text-xs font-medium tracking-tight text-foreground/85">
          ToDos
        </span>
        <span className={displayTodoFooterCountClassName(urgency)} aria-hidden>
          {countLabel}
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen} direction="bottom">
        <DrawerContent className={drawerContentClassName("formMd")}>
          <DrawerHeader>
            <DrawerTitle>Offene ToDos</DrawerTitle>
            <DrawerDescription>
              Schalter auf „Erledigt“ — bei erlaubten ToDos per Einstellung wieder
              zurücknehmbar.
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[min(60dvh,420px)] space-y-3 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : todos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Keine offenen ToDos.
              </p>
            ) : (
              todos.map((todo) => (
                <div
                  key={todo.id}
                  className="rounded-2xl border border-border/50 bg-muted/15 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="font-medium">{todo.title}</p>
                    <Badge
                      variant="outline"
                      className={staffTodoPriorityBadgeClass(todo.priority)}
                    >
                      {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={staffTodoStatusBadgeClass(
                        todo.done_for_staff ? "done" : todo.status,
                      )}
                    >
                      {STAFF_TODO_STATUS_LABELS[
                        todo.done_for_staff ? "done" : todo.status
                      ]}
                    </Badge>
                  </div>
                  {todo.description ? (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {todo.description}
                    </p>
                  ) : null}
                  <DisplayTodoCompleteToggle
                    checked={todo.done_for_staff}
                    allowReopen={todo.allow_reopen_on_display}
                    busy={busyId === todo.id}
                    disabled={busyId != null && busyId !== todo.id}
                    onMarkComplete={() => void handleComplete(todo)}
                    onMarkIncomplete={() => void handleReopen(todo)}
                  />
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
