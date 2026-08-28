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

/** Page-default exports that the scan mis-resolves (inline pages / UI imports). */
const MANUAL_PAGE_IMPORTS = {
  "/dashboard/profile/persoenliche-daten": {
    component: "ProfilePersoenlicheDatenScreen",
    from: "@/components/profile/profile-persoenliche-daten-screen",
  },
  "/dashboard/profile/anmeldung": {
    component: "ProfileAnmeldungScreen",
    from: "@/components/profile/profile-anmeldung-screen",
  },
  "/dashboard/settings/integrationen": {
    component: "SettingsIntegrationenRoute",
    from: "../routes/settings-integrationen-route",
  },
  // RestaurantSettingsPanel braucht section — ohne Wrapper bleibt Übersicht/Öffnungszeiten leer.
  "/dashboard/settings/restaurant": {
    component: "SettingsRestaurantRoute",
    from: "../routes/settings-restaurant-route",
  },
  "/dashboard/settings/oeffnungszeiten": {
    component: "SettingsOeffnungszeitenRoute",
    from: "../routes/settings-oeffnungszeiten-route",
  },
};

const PROFILE_PREFIX = "/dashboard/profile/";
const SETTINGS_PREFIX = "/dashboard/settings/";
const STAFF_PREFIX = "/dashboard/mitarbeiter/";
const STAFF_HOME = "/dashboard/mitarbeiter/uebersicht";
const POS_PREFIX = "/dashboard/pos/";
const POS_HOME = "/dashboard/pos/uebersicht";
const CHANGELOG_ROUTE = "/dashboard/changelog";

/**
 * Module subpages that need RegisterModuleChrome + AppMain in the SPA
 * (Next layouts were pruned). Keep-alive homes wrap themselves.
 */
const MODULE_SUBPAGE_CHROME = [
  {
    key: "inventory",
    prefix: "/dashboard/inventory/",
    homes: new Set(["/dashboard/inventory/uebersicht"]),
  },
  {
    key: "menu",
    prefix: "/dashboard/menu/",
    homes: new Set(["/dashboard/menu/uebersicht"]),
  },
  {
    key: "reservierungen",
    prefix: "/dashboard/reservierungen/",
    homes: new Set(["/dashboard/reservierungen/uebersicht"]),
  },
  {
    key: "events",
    prefix: "/dashboard/events/",
    homes: new Set(["/dashboard/events/uebersicht"]),
  },
  {
    key: "kontakte",
    prefix: "/dashboard/kontakte/",
    homes: new Set(["/dashboard/kontakte/nachrichten"]),
  },
  {
    key: "news",
    prefix: "/dashboard/news/",
    homes: new Set(["/dashboard/news/uebersicht"]),
  },
  {
    key: "bewertungen",
    prefix: "/dashboard/bewertungen/",
    homes: new Set(["/dashboard/bewertungen/uebersicht"]),
  },
  {
    key: "galerie",
    prefix: "/dashboard/galerie/",
    homes: new Set(["/dashboard/galerie/uebersicht"]),
  },
  {
    key: "buchfuehrung",
    prefix: "/dashboard/buchfuehrung/",
    homes: new Set(["/dashboard/buchfuehrung/rechnungen"]),
  },
  {
    key: "dokumente",
    prefix: "/dashboard/dokumente/",
    homes: new Set(["/dashboard/dokumente/uebersicht"]),
  },
  {
    key: "checklisten",
    prefix: "/dashboard/checklisten/",
    homes: new Set(["/dashboard/checklisten"]),
  },
];

/** Routes not (yet) in the Next filesystem scan — still part of the SPA tab stack. */
const EXTRA_ROUTE_ENTRIES = [
  {
    route: CHANGELOG_ROUTE,
    pageBehavior: "render",
    imports: [
      {
        component: "ChangelogOverview",
        from: "@/components/changelog/changelog-overview",
      },
    ],
  },
  {
    route: "/dashboard/mitarbeiter/arbeitszeiten/beheben",
    pageBehavior: "render",
    imports: [
      {
        component: "StaffLaborComplianceScreen",
        from: "@/components/staff/staff-labor-compliance-screen",
      },
    ],
  },
];

function chromeWrapperFor(route) {
  if (route === "/dashboard/profile" || route.startsWith(PROFILE_PREFIX)) {
    return "profile";
  }
  if (route === "/dashboard/settings" || route.startsWith(SETTINGS_PREFIX)) {
    return "settings";
  }
  if (route === CHANGELOG_ROUTE) {
    return "changelog";
  }
  // Übersicht = Keep-alive Host mit eigenem Chrome — kein Layout-Wrap.
  if (
    route.startsWith(STAFF_PREFIX) &&
    route !== STAFF_HOME &&
    route !== "/dashboard/mitarbeiter"
  ) {
    return "staff";
  }
  if (
    route.startsWith(POS_PREFIX) &&
    route !== POS_HOME &&
    route !== "/dashboard/pos"
  ) {
    return "pos";
  }
  for (const mod of MODULE_SUBPAGE_CHROME) {
    if (route.startsWith(mod.prefix) && !mod.homes.has(route)) {
      return { type: "module", key: mod.key };
    }
  }
  return null;
}

const lines = [];
lines.push(
  `/** Auto-generated — run: node scripts/generate-dashboard-vite-routes.mjs`,
);
lines.push(
  ` * Profile/Settings/Staff/Changelog/POS/module subpages use chrome wrappers (layouts pruned with SPA).`,
);
lines.push(` */`);
lines.push(`import { lazy, type ComponentType } from "react";`);
lines.push(`import { wrapChangelogPage } from "../routes/changelog-chrome";`);
lines.push(`import { wrapProfilePage } from "../routes/profile-chrome";`);
lines.push(`import { wrapSettingsPage } from "../routes/settings-chrome";`);
lines.push(`import { wrapStaffPage } from "../routes/staff-chrome";`);
lines.push(
  `import { moduleSubpageLazy } from "../routes/module-subpage-chrome";`,
);
lines.push(
  `import { wrapPosComingSoonPage } from "@/components/pos/pos-coming-soon-gate";`,
);
lines.push("");
lines.push(`function profileLazy(`);
lines.push(`  importer: () => Promise<{ default: ComponentType }>,`);
lines.push(`) {`);
lines.push(`  return lazy(async () => {`);
lines.push(`    const mod = await importer();`);
lines.push(`    return { default: wrapProfilePage(mod.default) };`);
lines.push(`  });`);
lines.push(`}`);
lines.push("");
lines.push(`function settingsLazy(`);
lines.push(`  importer: () => Promise<{ default: ComponentType }>,`);
lines.push(`) {`);
lines.push(`  return lazy(async () => {`);
lines.push(`    const mod = await importer();`);
lines.push(`    return { default: wrapSettingsPage(mod.default) };`);
lines.push(`  });`);
lines.push(`}`);
lines.push("");
lines.push(`function staffLazy(`);
lines.push(`  importer: () => Promise<{ default: ComponentType }>,`);
lines.push(`) {`);
lines.push(`  return lazy(async () => {`);
lines.push(`    const mod = await importer();`);
lines.push(`    return { default: wrapStaffPage(mod.default) };`);
lines.push(`  });`);
lines.push(`}`);
lines.push("");
lines.push(`function changelogLazy(`);
lines.push(`  importer: () => Promise<{ default: ComponentType }>,`);
lines.push(`) {`);
lines.push(`  return lazy(async () => {`);
lines.push(`    const mod = await importer();`);
lines.push(`    return { default: wrapChangelogPage(mod.default) };`);
lines.push(`  });`);
lines.push(`}`);
lines.push("");
lines.push(`function posLazy(`);
lines.push(`  importer: () => Promise<{ default: ComponentType }>,`);
lines.push(`) {`);
lines.push(`  return lazy(async () => {`);
lines.push(`    const mod = await importer();`);
lines.push(`    return { default: wrapPosComingSoonPage(mod.default) };`);
lines.push(`  });`);
lines.push(`}`);
lines.push("");

const lazyLines = [];
const routeEntries = [];

const scanRoutes = new Set(scan.map((entry) => entry.route));
const allEntries = [
  ...scan,
  ...EXTRA_ROUTE_ENTRIES.filter((entry) => !scanRoutes.has(entry.route)),
];

for (const entry of allEntries) {
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

  const manual = MANUAL_PAGE_IMPORTS[entry.route];
  if (manual) {
    importFrom = manual.from;
    componentName = manual.component;
  } else if (entry.pageBehavior === "null") {
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
  const chrome = chromeWrapperFor(entry.route);
  if (chrome === "profile") {
    lazyLines.push(
      `const ${lazyName} = profileLazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
    );
  } else if (chrome === "settings") {
    lazyLines.push(
      `const ${lazyName} = settingsLazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
    );
  } else if (chrome === "staff") {
    lazyLines.push(
      `const ${lazyName} = staffLazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
    );
  } else if (chrome === "changelog") {
    lazyLines.push(
      `const ${lazyName} = changelogLazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
    );
  } else if (chrome === "pos") {
    lazyLines.push(
      `const ${lazyName} = posLazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
    );
  } else if (chrome && typeof chrome === "object" && chrome.type === "module") {
    lazyLines.push(
      `const ${lazyName} = lazy(moduleSubpageLazy("${chrome.key}", () => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType }))));`,
    );
  } else {
    lazyLines.push(
      `const ${lazyName} = lazy(() => import("${importFrom}").then((m) => ({ default: m.${componentName} as ComponentType })));`,
    );
  }

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
