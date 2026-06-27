"use client";

import { Suspense, useMemo } from "react";
import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  CHECKLISTEN_NAV,
  CHECKLISTEN_ROUTES,
} from "@/lib/navigation/checklisten-routes";

function ChecklistenLayoutInner({ children }: { children: React.ReactNode }) {
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");
  const canReadCompliance = hasModuleRead(has, "compliance");
  const canAccess = canReadTodos || canReadCompliance;

  const subnavItems = useMemo(() => {
    return CHECKLISTEN_NAV.filter((item) => {
      if (item.href === CHECKLISTEN_ROUTES.root) return true;
      if (item.href === CHECKLISTEN_ROUTES.todos) return canReadTodos;
      return canReadTodos || canReadCompliance;
    });
  }, [canReadTodos, canReadCompliance]);

  if (!permissionsLoading && !canAccess) {
    return (
      <>
        <RegisterModuleChrome
          title="Checklisten"
          subnavAriaLabel="Checklisten-Bereiche"
          subnavItems={CHECKLISTEN_NAV}
        />
        <AppMain>
          <ModuleAccessDenied label="Checklisten" />
        </AppMain>
      </>
    );
  }

  return (
    <>
      <RegisterModuleChrome
        title="Checklisten"
        subnavAriaLabel="Checklisten-Bereiche"
        subnavItems={subnavItems}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}

export default function ChecklistenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <ChecklistenLayoutInner>{children}</ChecklistenLayoutInner>
    </Suspense>
  );
}
