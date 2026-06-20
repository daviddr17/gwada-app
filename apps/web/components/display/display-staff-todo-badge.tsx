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
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
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
import { cn } from "@/lib/utils";

type DisplayOpenTodo = {
  id: string;
  title: string;
  description: string | null;
  priority: StaffTodoPriority;
  status: StaffTodoComputedStatus;
};

function isOpenDisplayTodo(status: StaffTodoComputedStatus): boolean {
  return status !== "done" && status !== "archived" && status !== "planned";
}

type DisplayStaffTodoBadgeProps = {
  count: number;
  onChanged?: () => void;
};

export function DisplayStaffTodoBadge({
  count,
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
      setTodos((data.todos ?? []).filter((t) => isOpenDisplayTodo(t.status)));
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

  const handleComplete = async (todoId: string) => {
    setBusyId(todoId);
    try {
      const res = await fetch("/api/display/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete", todo_id: todoId }),
      });
      if (!res.ok) {
        toast.error("Erledigen fehlgeschlagen.");
        return;
      }
      toast.success("ToDo erledigt.");
      onChanged?.();
      const next = todos.filter((t) => t.id !== todoId);
      setTodos(next);
      if (next.length === 0) setOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  if (count <= 0) return null;

  return (
    <>
      <button
        type="button"
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${count} offene ToDos — tippen zum Erledigen`}
        onClick={() => setOpen(true)}
      >
        <Badge
          variant="outline"
          className="cursor-pointer border-amber-500/40 bg-amber-500/10 text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
        >
          {count} ToDo{count === 1 ? "" : "s"}
        </Badge>
      </button>

      <Drawer open={open} onOpenChange={setOpen} direction="bottom">
        <DrawerContent className={drawerContentClassName("formMd")}>
          <DrawerHeader>
            <DrawerTitle>Offene ToDos</DrawerTitle>
            <DrawerDescription>
              Tippen Sie auf Erledigt — auch während einer verschobenen Aufgabe.
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
                      className={staffTodoStatusBadgeClass(todo.status)}
                    >
                      {STAFF_TODO_STATUS_LABELS[todo.status]}
                    </Badge>
                  </div>
                  {todo.description ? (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {todo.description}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="lg"
                    className={cn(
                      "h-12 w-full rounded-xl",
                      brandActionButtonRoundedClassName,
                    )}
                    disabled={busyId != null}
                    onClick={() => void handleComplete(todo.id)}
                  >
                    {busyId === todo.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Erledigt
                  </Button>
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
