"use client";

import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { DashboardSpaShell } from "../shell/dashboard-spa-shell";
import { DASHBOARD_ROUTE_ENTRIES } from "../generated/route-modules";
import { GenericModulePendingSkeleton } from "../ui/generic-module-pending-skeleton";

function RoutePage({
  Lazy,
  fullPath,
}: {
  Lazy: LazyExoticComponent<ComponentType<Record<string, unknown>>>;
  fullPath: string;
}) {
  const isKeepAlive =
    fullPath.includes("uebersicht") ||
    fullPath === "/dashboard" ||
    fullPath.endsWith("/nachrichten") ||
    fullPath.endsWith("/rechnungen") ||
    fullPath === "/dashboard/checklisten";

  if (isKeepAlive) {
    return <Lazy active={true} showChrome={true} />;
  }
  return <Lazy />;
}

const rootRoute = createRootRoute({
  component: DashboardSpaShell,
});

function toTanstackPath(fullPath: string): string {
  if (fullPath === "/dashboard") return "/";
  return fullPath.replace(/^\/dashboard/, "") || "/";
}

const childRoutes = DASHBOARD_ROUTE_ENTRIES.map((entry) => {
  const path = entry.path === "/" ? "/" : entry.path.replace(/^\//, "");

  if (entry.redirect) {
    const redirectTo = toTanstackPath(entry.redirect);
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        throw redirect({ to: redirectTo });
      },
    });
  }

  const Lazy = entry.Lazy!;
  const fullPath = entry.fullPath;

  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => (
      <Suspense fallback={<GenericModulePendingSkeleton />}>
        <RoutePage Lazy={Lazy} fullPath={fullPath} />
      </Suspense>
    ),
  });
});

export const dashboardRouteTree = rootRoute.addChildren(childRoutes);

export const dashboardRouter = createRouter({
  routeTree: dashboardRouteTree,
  basepath: "/dashboard",
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof dashboardRouter;
  }
}
