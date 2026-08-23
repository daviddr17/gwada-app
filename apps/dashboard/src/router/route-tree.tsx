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
import { dashboardHrefToTanstackTarget } from "@/lib/navigation/dashboard-spa-path";

const rootRoute = createRootRoute({
  component: DashboardSpaShell,
});

const childRoutes = DASHBOARD_ROUTE_ENTRIES.map((entry) => {
  const path = entry.path === "/" ? "/" : entry.path.replace(/^\//, "");

  if (entry.redirect) {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        const { to, search } = dashboardHrefToTanstackTarget(entry.redirect!);
        throw redirect({
          to,
          search: Object.keys(search).length > 0 ? search : undefined,
        });
      },
    });
  }

  // Modul-Homes: UI nur in AppModuleHomeKeepAlives — Outlet bleibt null (kein Doppel-Mount).
  if (entry.keepAliveHome) {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    });
  }

  const Lazy = entry.Lazy as LazyExoticComponent<
    ComponentType<Record<string, unknown>>
  >;

  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => (
      <Suspense fallback={<GenericModulePendingSkeleton />}>
        <Lazy />
      </Suspense>
    ),
  });
});

export const dashboardRouteTree = rootRoute.addChildren(childRoutes);

export const dashboardRouter = createRouter({
  routeTree: dashboardRouteTree,
  basepath: "/dashboard",
  defaultPreload: "intent",
  defaultPreloadStaleTime: 60_000,
  defaultPendingMinMs: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof dashboardRouter;
  }
}
