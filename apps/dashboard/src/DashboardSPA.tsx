"use client";

import { RouterProvider } from "@tanstack/react-router";
import { dashboardRouter } from "./router/route-tree";

/** TanStack Router SPA — SoftNavLockProvider in {@link DashboardSpaShell} (Router-Kontext). */
export function DashboardSPA() {
  return <RouterProvider router={dashboardRouter} />;
}
