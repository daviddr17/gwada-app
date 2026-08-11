"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { ChecklistenOverviewScreen } from "@/components/checklisten/checklisten-overview-screen";
import { StaffTodosScreen } from "@/components/staff/todos/staff-todos-screen";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { CHECKLISTEN_NAV } from "@/lib/navigation/checklisten-routes";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";

export function ChecklistenHomeKeepAliveScreen({ active }: { active: boolean }) {
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");

  return (
    <ModuleHomeKeepAliveShell
      active={active}
      title="Checklisten"
      subnavAriaLabel="Checklisten-Bereiche"
      subnavItems={CHECKLISTEN_NAV}
    >
      {permissionsLoading ? null : canReadTodos ? (
        <StaffTodosScreen active={active} />
      ) : (
        <ChecklistenOverviewScreen active={active} />
      )}
    </ModuleHomeKeepAliveShell>
  );
}
