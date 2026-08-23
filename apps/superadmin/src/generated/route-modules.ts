import { lazy } from "react";

/** Stub — run route generator to populate SUPERADMIN_ROUTE_ENTRIES. */
export type SuperadminRouteEntry = {
  path: string;
  fullPath: string;
  redirect?: string;
  Lazy?: ReturnType<typeof lazy>;
};

export const SUPERADMIN_ROUTE_ENTRIES: SuperadminRouteEntry[] = [];
