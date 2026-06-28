"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { isAssignedToStaffMember } from "@/lib/staff/assignee-matching";
import { staffTodosPageUrl } from "@/lib/staff/staff-todo-navigation";
import {
  fetchStaffTodosForRestaurant,
  staffTodoAssigneeLabel,
} from "@/lib/supabase/staff-todos-db";
import {
  computeStaffTodoStatus,
  STAFF_TODO_STATUS_LABELS,
  staffTodoStatusBadgeClass,
} from "@/lib/staff/staff-todo-status";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import type { RestaurantStaffRow } from "@/lib/types/staff";

function todoMatchesStaff(todo: RestaurantStaffTodoRow, staff: RestaurantStaffRow): boolean {
  return isAssignedToStaffMember(todo, staff.id, staff.position_tag_id ?? null, {
    emptyMeansAll: false,
  });
}

type StaffTodoProfileSectionProps = {
  restaurantId: string;
  staff: RestaurantStaffRow;
};

export function StaffTodoProfileSection({
  restaurantId,
  staff,
}: StaffTodoProfileSectionProps) {
  const router = useRouter();
  const [todos, setTodos] = useState<RestaurantStaffTodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantTimezone, setRestaurantTimezone] = useState(
    DEFAULT_RESTAURANT_TIMEZONE,
  );

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error, restaurantTimezone: tz } =
      await fetchStaffTodosForRestaurant(restaurantId);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    setRestaurantTimezone(tz);
    setTodos(data.filter((t) => todoMatchesStaff(t, staff)));
  }, [restaurantId, staff]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openTodos = todos.filter((t) => {
    const status = computeStaffTodoStatus(
      t,
      t.completions,
      1,
      new Date(),
      restaurantTimezone,
    );
    return status !== "done" && status !== "archived";
  });

  const preview = openTodos.slice(0, 3);

  return (
    <button
      type="button"
      className="flex w-full flex-col gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-left transition-colors hover:bg-muted/25"
      onClick={() => router.push(staffTodosPageUrl(staff.id))}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ListTodo className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">ToDo-Listen</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Wird geladen …</p>
      ) : openTodos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine offenen ToDos</p>
      ) : (
        <ul className="space-y-1.5">
          {preview.map((todo) => {
            const status = computeStaffTodoStatus(
              todo,
              todo.completions,
              1,
              new Date(),
              restaurantTimezone,
            );
            return (
              <li
                key={todo.id}
                className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="min-w-0 truncate font-medium text-foreground">
                  {todo.title}
                </span>
                <Badge
                  variant="outline"
                  className={staffTodoStatusBadgeClass(status)}
                >
                  {STAFF_TODO_STATUS_LABELS[status]}
                </Badge>
              </li>
            );
          })}
          {openTodos.length > preview.length ? (
            <li className="text-xs text-muted-foreground">
              +{openTodos.length - preview.length} weitere
            </li>
          ) : null}
        </ul>
      )}
      {!loading && openTodos.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {openTodos.length} offen · Zuordnung: {staffTodoAssigneeLabel(openTodos[0]!)}
        </p>
      ) : null}
    </button>
  );
}
