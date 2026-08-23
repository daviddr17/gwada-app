#!/usr/bin/env node
/**
 * Generates TanStack Router route modules from dashboard-routes-scan.json
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const scan = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dashboard-routes-scan.json"), "utf8"),
);

const KEEP_ALIVE_IMPORTS = {
  "/dashboard": {
    component: "DashboardHomeScreen",
    from: "@/components/dashboard/dashboard-home-screen",
  },
  "/dashboard/menu/uebersicht": {
    component: "MenuOverviewKeepAliveScreen",
    from: "@/components/menu/menu-overview-keep-alive-screen",
  },
  "/dashboard/inventory/uebersicht": {
    component: "InventoryOverviewKeepAliveScreen",
    from: "@/components/inventory/inventory-overview-keep-alive-screen",
  },
  "/dashboard/reservierungen/uebersicht": {
    component: "ReservationsOverviewKeepAliveScreen",
    from: "@/components/reservations/reservations-overview-keep-alive-screen",
  },
  "/dashboard/pos/uebersicht": {
    component: "PosOverviewKeepAliveScreen",
    from: "@/components/pos/pos-overview-keep-alive-screen",
  },
  "/dashboard/events/uebersicht": {
    component: "EventsOverviewKeepAliveScreen",
    from: "@/components/events/events-overview-keep-alive-screen",
  },
  "/dashboard/kontakte/nachrichten": {
    component: "ContactsMessagesKeepAliveScreen",
    from: "@/components/contacts/contacts-messages-keep-alive-screen",
  },
  "/dashboard/news/uebersicht": {
    component: "NewsOverviewKeepAliveScreen",
    from: "@/components/news/news-overview-keep-alive-screen",
  },
  "/dashboard/bewertungen/uebersicht": {
    component: "ReviewsOverviewKeepAliveScreen",
    from: "@/components/reviews/reviews-overview-keep-alive-screen",
  },
  "/dashboard/insights/uebersicht": {
    component: "InsightsOverviewKeepAliveScreen",
    from: "@/components/insights/insights-overview-keep-alive-screen",
  },
  "/dashboard/galerie/uebersicht": {
    component: "GalleryOverviewKeepAliveScreen",
    from: "@/components/gallery/gallery-overview-keep-alive-screen",
  },
  "/dashboard/buchfuehrung/rechnungen": {
    component: "AccountingInvoicesKeepAliveScreen",
    from: "@/components/accounting/accounting-invoices-keep-alive-screen",
  },
  "/dashboard/dokumente/uebersicht": {
    component: "DocumentsOverviewKeepAliveScreen",
    from: "@/components/documents/documents-overview-keep-alive-screen",
  },
  "/dashboard/checklisten": {
    component: "ChecklistenHomeKeepAliveScreen",
    from: "@/components/checklisten/checklisten-home-keep-alive-screen",
  },
  "/dashboard/mitarbeiter/uebersicht": {
    component: "StaffOverviewKeepAliveScreen",
    from: "@/components/staff/staff-overview-keep-alive-screen",
  },
};

const lines = [];
lines.push(`/** Auto-generated — run: node scripts/generate-dashboard-vite-routes.mjs */`);
lines.push(`import { lazy, type ComponentType } from "react";`);
lines.push("");

const lazyLines = [];
const routeEntries = [];

for (const entry of scan) {
  const routePath = entry.route.replace(/^\/dashboard/, "") || "/";
  const tanstackPath = routePath === "/" ? "/" : routePath;

  if (entry.pageBehavior === "redirect") {
    routeEntries.push({
      path: tanstackPath,
      redirect: entry.redirectTarget,
    });
    continue;
  }

  let importFrom;
  let componentName;

  if (entry.pageBehavior === "null") {
    if (!KEEP_ALIVE_IMPORTS[entry.route]) {
      console.warn("Missing keep-alive mapping for", entry.route);
      continue;
    }
    // UI lives in AppModuleHomeKeepAlives — route leaf is null.
    routeEntries.push({
      path: tanstackPath,
      fullPath: entry.route,
      keepAliveHome: true,
    });
    continue;
  } else if (entry.pageBehavior === "render") {
    const imp = entry.imports?.[0];
    if (!imp) {
      console.warn("Missing import for render route", entry.route);
      continue;
    }
    importFrom = imp.from;
    componentName = imp.component;
  } else {
    continue;
  }

  const lazyName = `Lazy_${entry.route.replace(/[^a-zA-Z0-9]/g, "_")}`;
  lazyLines.push(
    `const ${lazyName} = lazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
  );

  routeEntries.push({
    path: tanstackPath,
    lazy: lazyName,
    fullPath: entry.route,
  });
}

lines.push(...lazyLines);
lines.push("");
lines.push("export type DashboardRouteEntry = {");
lines.push("  path: string;");
lines.push("  fullPath: string;");
lines.push("  redirect?: string;");
lines.push("  keepAliveHome?: boolean;");
lines.push("  Lazy?: ReturnType<typeof lazy>;");
lines.push("};");
lines.push("");
lines.push("export const DASHBOARD_ROUTE_ENTRIES: DashboardRouteEntry[] = [");

for (const r of routeEntries) {
  if (r.redirect) {
    lines.push(
      `  { path: "${r.path}", fullPath: "${r.redirect}", redirect: "${r.redirect}" },`,
    );
  } else if (r.keepAliveHome) {
    lines.push(
      `  { path: "${r.path}", fullPath: "${r.fullPath}", keepAliveHome: true },`,
    );
  } else {
    lines.push(
      `  { path: "${r.path}", fullPath: "${r.fullPath}", Lazy: ${r.lazy} },`,
    );
  }
}

lines.push("];");
lines.push("");

const outDir = path.join(ROOT, "apps/dashboard/src/generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "route-modules.ts"), lines.join("\n"));
console.log(`Generated ${routeEntries.length} routes → apps/dashboard/src/generated/route-modules.ts`);
