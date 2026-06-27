"use client";

import { Suspense } from "react";
import { ChecklistenOverviewScreen } from "@/components/checklisten/checklisten-overview-screen";
import { StaffTodosScreen } from "@/components/staff/todos/staff-todos-screen";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";

function ChecklistenPageInner() {
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");

  if (permissionsLoading) return null;
  if (canReadTodos) return <StaffTodosScreen />;
  return <ChecklistenOverviewScreen />;
}

export default function ChecklistenOverviewPage() {
  return (
    <Suspense fallback={null}>
      <ChecklistenPageInner />
    </Suspense>
  );
}
