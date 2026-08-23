"use client";

import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { usePathname } from "next/navigation";
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

function isRouteActive(pathname: string, fullPath: string): boolean {
  const basePath = fullPath.split("?")[0];
  if (basePath === "/dashboard") return pathname === "/dashboard";
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function RoutePage({
  Lazy,
  fullPath,
}: {
  Lazy: LazyExoticComponent<ComponentType<Record<string, unknown>>>;
  fullPath: string;
}) {
  const pathname = usePathname();
  const isKeepAlive =
    fullPath.includes("uebersicht") ||
    fullPath === "/dashboard" ||
    fullPath.endsWith("/nachrichten") ||
    fullPath.endsWith("/rechnungen") ||
    fullPath === "/dashboard/checklisten";

  if (isKeepAlive) {
    const isActive = isRouteActive(pathname, fullPath);
    return <Lazy active={isActive} showChrome={isActive} />;
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
  defaultPreloadStaleTime: 60_000,
  defaultPendingMinMs: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof dashboardRouter;
  }
}
