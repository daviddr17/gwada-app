"use client";

import { Suspense, type ComponentType, type LazyExoticComponent } from "react";
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

export const superadminRouteTree = rootRoute.addChildren(childRoutes);

export const superadminRouter = createRouter({
  routeTree: superadminRouteTree,
  basepath: "/superadmin",
  defaultPreload: "intent",
  defaultPreloadStaleTime: 60_000,
  defaultPendingMinMs: 0,
});
