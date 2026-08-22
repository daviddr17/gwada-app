"use client";

import { RouterProvider } from "@tanstack/react-router";
import { SoftNavLockProvider } from "./shims/soft-nav-lock-provider";
import { dashboardRouter } from "./router/route-tree";

/** TanStack Router SPA — Provider aus `(app)/layout`, SoftNav-Shim hier (Router-Kontext). */
export function DashboardSPA() {
  return (
    <SoftNavLockProvider>
      <RouterProvider router={dashboardRouter} />
    </SoftNavLockProvider>
  );
}
