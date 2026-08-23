"use client";

import { RouterProvider } from "@tanstack/react-router";
import { superadminRouter } from "./router/route-tree";

/** TanStack Router SPA — SoftNavLockProvider in {@link SuperadminSpaShell} (Router-Kontext). */
export function SuperadminSPA() {
  return <RouterProvider router={superadminRouter} />;
}
