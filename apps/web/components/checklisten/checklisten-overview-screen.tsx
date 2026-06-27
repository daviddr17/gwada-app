"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHECKLISTEN_ROUTES } from "@/lib/navigation/checklisten-routes";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  assignedPositionTagIds,
  assignedStaffIds,
  fetchStaffTodosForRestaurant,
} from "@/lib/supabase/staff-todos-db";
import {
  computeStaffTodoStatus,
  staffTodoPriorityBadgeClass,
  STAFF_TODO_STATUS_LABELS,
} from "@/lib/staff/staff-todo-status";
import {
  fetchChecklistDevices,
  loadChecklistAreas,
} from "@/lib/supabase/checklist-areas-devices-db";
import {
  fetchComplianceRecords,
  fetchComplianceSettings,
} from "@/lib/supabase/compliance-db";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import { staffTodoRecurrenceLabel } from "@/lib/staff/staff-todo-meta";
import { cn } from "@/lib/utils";

function assigneeCount(todo: RestaurantStaffTodoRow): number {
  const staff = assignedStaffIds(todo).length;
  const positions = assignedPositionTagIds(todo).length;
  return Math.max(1, staff + positions);
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return !Number.isNaN(d.getTime()) && d >= start;
}

function todoSortWeight(todo: RestaurantStaffTodoRow): number {
  const status = computeStaffTodoStatus(todo, todo.completions, assigneeCount(todo));
  const priorityWeight =
    todo.priority === "high" ? 0 : todo.priority === "medium" ? 1 : 2;
  const statusWeight =
    status === "overdue" ? 0 : status === "open" ? 1 : status === "partial" ? 2 : 9;
  return statusWeight * 10 + priorityWeight;
}

export function ChecklistenOverviewScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");
  const canReadCompliance = hasModuleRead(has, "compliance");

  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<RestaurantStaffTodoRow[]>([]);
  const [areaCount, setAreaCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [capturesToday, setCapturesToday] = useState(0);
  const [showDueReminders, setShowDueReminders] = useState(true);

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    const [todoRes, areasRes, devicesRes, recordsRes, settingsRes] =
      await Promise.all([
        canReadTodos
          ? fetchStaffTodosForRestaurant(restaurantId)
          : Promise.resolve({ data: [], error: null }),
        canReadTodos
          ? loadChecklistAreas(restaurantId)
          : Promise.resolve({ data: [], error: null }),
        canReadTodos
          ? fetchChecklistDevices(restaurantId)
          : Promise.resolve({ data: [], error: null }),
        canReadCompliance
          ? fetchComplianceRecords(restaurantId, { limit: 500 })
          : Promise.resolve({ data: [], error: null }),
        canReadCompliance
          ? fetchComplianceSettings(restaurantId)
          : Promise.resolve({ data: null, error: null }),
      ]);

    setLoading(false);

    if (!todoRes.error || isMissingSchemaError(todoRes.error)) {
      setTodos(todoRes.data);
    } else {
      setTodos([]);
    }

    setAreaCount(areasRes.data.filter((a) => a.active).length);
    setDeviceCount(devicesRes.data.filter((d) => d.is_active).length);

    let todayCaptures = 0;
    if (canReadTodos) {
      for (const todo of todoRes.data) {
        for (const c of todo.completions ?? []) {
          if (c.completed_at && !c.reopened_at && isToday(c.completed_at)) {
            todayCaptures += 1;
          }
        }
      }
    }
    if (canReadCompliance && !recordsRes.error) {
      todayCaptures += recordsRes.data.filter((r) => isToday(r.performed_at)).length;
    }
    setCapturesToday(todayCaptures);

    if (!settingsRes.error) {
      setShowDueReminders(settingsRes.data?.show_due_reminders ?? true);
    }
  }, [restaurantId, canReadTodos, canReadCompliance]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openTodos = useMemo(
    () =>
      todos.filter((t) => {
        const status = computeStaffTodoStatus(t, t.completions, assigneeCount(t));
        return status !== "done" && status !== "archived" && status !== "planned";
      }),
    [todos],
  );

  const overdueTodos = useMemo(
    () =>
      openTodos.filter(
        (t) =>
          computeStaffTodoStatus(t, t.completions, assigneeCount(t)) === "overdue",
      ),
    [openTodos],
  );

  const attentionTodos = useMemo(
    () =>
      [...openTodos]
        .sort((a, b) => todoSortWeight(a) - todoSortWeight(b))
        .slice(0, 6),
    [openTodos],
  );

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const kpiCards = [
    canReadTodos
      ? {
          key: "open",
          label: "Offene Aufgaben",
          value: loading ? "—" : openTodos.length,
        }
      : null,
    canReadTodos
      ? {
          key: "overdue",
          label: "Überfällig",
          value: loading ? "—" : overdueTodos.length,
        }
      : null,
    canReadTodos
      ? {
          key: "areas",
          label: "Bereiche",
          value: loading ? "—" : areaCount,
        }
      : null,
    canReadTodos
      ? {
          key: "devices",
          label: "Geräte",
          value: loading ? "—" : deviceCount,
        }
      : null,
    canReadTodos || canReadCompliance
      ? {
          key: "captures",
          label: "Erfassungen heute",
          value: loading ? "—" : capturesToday,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; value: number | string }[];

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Checklisten</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Kurzüberblick über offene Aufgaben, Bereiche, Geräte und heutige
          Erfassungen — Details in ToDo-Listen und Protokoll.
        </p>
      </div>

      {kpiCards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map((kpi) => (
            <Card key={kpi.key} className="border-border/50 shadow-card">
              <CardHeader className="pb-2">
                <CardDescription>{kpi.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{kpi.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {canReadTodos && showDueReminders && attentionTodos.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5 text-amber-600" />
              Braucht Aufmerksamkeit ({attentionTodos.length})
            </CardTitle>
            <CardDescription>
              Offene und überfällige Aufgaben — erfassen und abhaken in den
              ToDo-Listen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{todo.title}</p>
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
                    className={cn("font-normal", staffTodoPriorityBadgeClass(todo.priority))}
                  >
                    {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {!loading && canReadTodos && todos.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Aufgaben — legen Sie in{" "}
            <Link
              href={CHECKLISTEN_ROUTES.todos}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              ToDo-Listen
            </Link>{" "}
            die erste Checkliste an.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
