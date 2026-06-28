"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChecklistenTodosOverviewSection } from "@/components/checklisten/checklisten-todos-overview-section";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { fetchStaffTodosForRestaurant } from "@/lib/supabase/staff-todos-db";
import { DEFAULT_RESTAURANT_TIMEZONE, isSameRestaurantCalendarDay } from "@/lib/restaurant/restaurant-timezone";
import {
  fetchComplianceRecords,
  fetchComplianceSettings,
} from "@/lib/supabase/compliance-db";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";

export function ChecklistenOverviewScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");
  const canReadCompliance = hasModuleRead(has, "compliance");

  const [loading, setLoading] = useState(true);
  const [todos, setTodos] = useState<RestaurantStaffTodoRow[]>([]);
  const [capturesToday, setCapturesToday] = useState(0);
  const [showDueReminders, setShowDueReminders] = useState(true);
  const [restaurantTimezone, setRestaurantTimezone] = useState(
    DEFAULT_RESTAURANT_TIMEZONE,
  );

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);

    const [todoRes, recordsRes, settingsRes] = await Promise.all([
        canReadTodos
          ? fetchStaffTodosForRestaurant(restaurantId)
          : Promise.resolve({
              data: [],
              error: null,
              restaurantTimezone: DEFAULT_RESTAURANT_TIMEZONE,
            }),
        canReadCompliance
          ? fetchComplianceRecords(restaurantId, { limit: 500 })
          : Promise.resolve({ data: [], error: null }),
        canReadTodos || canReadCompliance
          ? fetchComplianceSettings(restaurantId)
          : Promise.resolve({ data: null, error: null }),
      ]);

    setLoading(false);

    if (!todoRes.error || isMissingSchemaError(todoRes.error)) {
      setTodos(todoRes.data);
      setRestaurantTimezone(todoRes.restaurantTimezone);
    } else {
      setTodos([]);
    }

    let todayCaptures = 0;
    const tz = todoRes.restaurantTimezone ?? DEFAULT_RESTAURANT_TIMEZONE;
    if (canReadTodos) {
      for (const todo of todoRes.data) {
        for (const c of todo.completions ?? []) {
          if (
            c.completed_at &&
            !c.reopened_at &&
            isSameRestaurantCalendarDay(c.completed_at, new Date(), tz)
          ) {
            todayCaptures += 1;
          }
        }
      }
    }
    if (canReadCompliance && !recordsRes.error) {
      todayCaptures += recordsRes.data.filter((r) =>
        isSameRestaurantCalendarDay(r.performed_at, new Date(), tz),
      ).length;
    }
    setCapturesToday(todayCaptures);

    if (!settingsRes.error) {
      setShowDueReminders(settingsRes.data?.show_due_reminders ?? true);
    }
  }, [restaurantId, canReadTodos, canReadCompliance]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-4 pb-4">
      <ChecklistenTodosOverviewSection
        loading={loading}
        todos={todos}
        capturesToday={capturesToday}
        showDueReminders={showDueReminders}
        canReadTodos={canReadTodos}
        canReadCompliance={canReadCompliance}
        restaurantTimezone={restaurantTimezone}
      />

      {!loading && canReadTodos && todos.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Aufgaben — ToDo-Listen sind in diesem Account nicht
            freigeschaltet oder es wurden noch keine angelegt.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
