"use client";

import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { usePathname } from "next/navigation";
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { SuperadminSpaShell } from "../shell/superadmin-spa-shell";
import { SUPERADMIN_ROUTE_ENTRIES } from "../generated/route-modules";
import { GenericModulePendingSkeleton } from "../ui/generic-module-pending-skeleton";
import { zoneHrefToTanstackTarget } from "@/lib/navigation/spa-zone-path";

function isRouteActive(pathname: string, fullPath: string): boolean {
  const basePath = fullPath.split("?")[0];
  if (basePath === "/superadmin") return pathname === "/superadmin";
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
  const isActive = isRouteActive(pathname, fullPath);
  return <Lazy active={isActive} showChrome={isActive} />;
}

const rootRoute = createRootRoute({
  component: SuperadminSpaShell,
});

const childRoutes = SUPERADMIN_ROUTE_ENTRIES.map((entry) => {
  const path = entry.path === "/" ? "/" : entry.path.replace(/^\//, "");

  if (entry.redirect) {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      beforeLoad: () => {
        const { to, search } = zoneHrefToTanstackTarget(
          "/superadmin",
          entry.redirect!,
        );
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

export const superadminRouteTree = rootRoute.addChildren(childRoutes);

export const superadminRouter = createRouter({
  routeTree: superadminRouteTree,
  basepath: "/superadmin",
  defaultPreload: "intent",
  defaultPreloadStaleTime: 60_000,
  defaultPendingMinMs: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof superadminRouter;
  }
}
