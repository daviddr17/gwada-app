"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactMetricPill,
  DashboardCompactMetricPillSkeleton,
} from "@/components/dashboard/dashboard-compact-list";
import {
  assignedPositionTagIds,
  assignedStaffIds,
} from "@/lib/supabase/staff-todos-db";
import {
  computeStaffTodoStatus,
  staffTodoPriorityBadgeClass,
  STAFF_TODO_STATUS_LABELS,
} from "@/lib/staff/staff-todo-status";
import { staffTodoRecurrenceLabel } from "@/lib/staff/staff-todo-meta";
import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import { cn } from "@/lib/utils";

function assigneeCount(todo: RestaurantStaffTodoRow): number {
  const staff = assignedStaffIds(todo).length;
  const positions = assignedPositionTagIds(todo).length;
  return Math.max(1, staff + positions);
}

function todoSortWeight(todo: RestaurantStaffTodoRow): number {
  const status = computeStaffTodoStatus(todo, todo.completions, assigneeCount(todo));
  const priorityWeight =
    todo.priority === "high" ? 0 : todo.priority === "medium" ? 1 : 2;
  const statusWeight =
    status === "overdue" ? 0 : status === "open" ? 1 : status === "partial" ? 2 : 9;
  return statusWeight * 10 + priorityWeight;
}

export type ChecklistenTodosOverviewSectionProps = {
  loading: boolean;
  todos: readonly RestaurantStaffTodoRow[];
  capturesToday: number;
  showDueReminders: boolean;
  canReadTodos: boolean;
  canReadCompliance: boolean;
  /** Bereichs-/Geräte-Chips — eigene Zeile über der KPI-Zusammenfassung. */
  taxonomySlot?: ReactNode;
};

export function ChecklistenTodosOverviewSection({
  loading,
  todos,
  capturesToday,
  showDueReminders,
  canReadTodos,
  canReadCompliance,
  taxonomySlot,
}: ChecklistenTodosOverviewSectionProps) {
  const openTodos = todos.filter((t) => {
    const status = computeStaffTodoStatus(t, t.completions, assigneeCount(t));
    return status !== "done" && status !== "archived" && status !== "planned";
  });

  const overdueTodos = openTodos.filter(
    (t) =>
      computeStaffTodoStatus(t, t.completions, assigneeCount(t)) === "overdue",
  );

  const attentionTodos = [...openTodos]
    .sort((a, b) => todoSortWeight(a) - todoSortWeight(b))
    .slice(0, 6);

  const showSummary =
    canReadTodos || canReadCompliance || taxonomySlot != null;

  if (!showSummary && !(canReadTodos && showDueReminders && attentionTodos.length > 0)) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      {taxonomySlot ? <div className="min-w-0">{taxonomySlot}</div> : null}

      {showSummary && (canReadTodos || canReadCompliance) ? (
        <DashboardCompactInlineMetrics>
          {loading ? (
            <>
              {canReadTodos ? (
                <>
                  <DashboardCompactMetricPillSkeleton />
                  <DashboardCompactMetricPillSkeleton />
                </>
              ) : null}
              {canReadTodos || canReadCompliance ? (
                <DashboardCompactMetricPillSkeleton />
              ) : null}
            </>
          ) : (
            <>
              {canReadTodos ? (
                <>
                  <DashboardCompactMetricPill
                    label="Offen"
                    value={String(openTodos.length)}
                  />
                  <DashboardCompactMetricPill
                    label="Überfällig"
                    value={String(overdueTodos.length)}
                    highlight={overdueTodos.length > 0}
                    stripeVariant={overdueTodos.length > 0 ? "attention" : undefined}
                  />
                </>
              ) : null}
              {canReadTodos || canReadCompliance ? (
                <DashboardCompactMetricPill
                  label="Heute erfasst"
                  value={String(capturesToday)}
                />
              ) : null}
            </>
          )}
        </DashboardCompactInlineMetrics>
      ) : null}

      {canReadTodos && showDueReminders && attentionTodos.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
          <CardHeader className="gap-1 px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Braucht Aufmerksamkeit ({attentionTodos.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Offene und überfällige Aufgaben — in der Liste darunter erfassen
              und abhaken.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 px-4 pb-3 pt-0">
            {attentionTodos.map((todo) => {
              const status = computeStaffTodoStatus(
                todo,
                todo.completions,
                assigneeCount(todo),
              );
              const recurrence = staffTodoRecurrenceLabel(todo.recurrence);
              return (
                <div
                  key={todo.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{todo.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {STAFF_TODO_STATUS_LABELS[status]}
                      {recurrence ? ` · ${recurrence}` : ""}
                      {todo.checklist_area?.name
                        ? ` · ${todo.checklist_area.name}`
                        : ""}
                      {todo.checklist_device?.name
                        ? ` · ${todo.checklist_device.name}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      staffTodoPriorityBadgeClass(todo.priority),
                    )}
                  >
                    {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
