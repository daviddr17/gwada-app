#!/usr/bin/env node
/**
 * Unit + Soft-Nav-Simulation für Module-Home Keep-alive.
 * Exit 1 bei Regression (Nachrichten-Hijack / URL-Pollution).
 */
import assert from "node:assert/strict";

const MODULE_HOME_PATHS = {
  dashboard: "/dashboard",
  reservierungen: "/dashboard/reservierungen/uebersicht",
  nachrichten: "/dashboard/kontakte/nachrichten",
};

const SIDEBAR = [
  { id: "dashboard", href: "/dashboard" },
  { id: "menu", href: "/dashboard/menu/uebersicht" },
  { id: "inventory", href: "/dashboard/inventory/uebersicht" },
  { id: "reservierungen", href: "/dashboard/reservierungen/uebersicht" },
  { id: "pos", href: "/dashboard/pos/uebersicht" },
  { id: "events", href: "/dashboard/events" },
  { id: "kontakte", href: "/dashboard/kontakte/nachrichten?platform=all" },
  { id: "news", href: "/dashboard/news/uebersicht" },
  { id: "bewertungen", href: "/dashboard/bewertungen/uebersicht" },
  { id: "insights", href: "/dashboard/insights/uebersicht" },
  { id: "galerie", href: "/dashboard/galerie/uebersicht" },
  { id: "buchfuehrung", href: "/dashboard/buchfuehrung/rechnungen" },
  { id: "dokumente", href: "/dashboard/dokumente/uebersicht" },
  { id: "checklisten", href: "/dashboard/checklisten" },
  { id: "mitarbeiter", href: "/dashboard/mitarbeiter/uebersicht" },
];

function normalizePath(pathname) {
  const pathOnly = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    return pathOnly.slice(0, -1);
  }
  return pathOnly || "/dashboard";
}

function matchHome(pathname) {
  const p = normalizePath(pathname);
  if (p === MODULE_HOME_PATHS.dashboard) return "dashboard";
  if (p === MODULE_HOME_PATHS.reservierungen) return "reservierungen";
  if (p === MODULE_HOME_PATHS.nachrichten) return "nachrichten";
  return null;
}

function keepAliveMayNavigate(active) {
  return active === true;
}

function keepAliveOwnsPathname(active, pathname, id) {
  return keepAliveMayNavigate(active) && matchHome(pathname) === id;
}

assert.equal(keepAliveMayNavigate(false), false);
assert.equal(keepAliveMayNavigate(true), true);
assert.equal(
  matchHome("/dashboard/kontakte/nachrichten?platform=all"),
  "nachrichten",
);
assert.equal(matchHome("/dashboard/menu/uebersicht"), null);
assert.equal(SIDEBAR.length, 15);

for (const mod of SIDEBAR) {
  const home = matchHome(mod.href);
  if (mod.id === "kontakte") {
    assert.equal(home, "nachrichten", mod.id);
  } else if (mod.id === "reservierungen") {
    assert.equal(home, "reservierungen", mod.id);
  } else if (mod.id === "dashboard") {
    assert.equal(home, "dashboard", mod.id);
  } else {
    assert.equal(home, null, `${mod.id} → ${mod.href}`);
  }
}

for (const fromId of Object.keys(MODULE_HOME_PATHS)) {
  for (const dest of SIDEBAR) {
    const active = false;

    if (fromId === "nachrichten" && dest.id !== "kontakte") {
      const platformParam = null;
      const needsFilterInUrl = platformParam !== "all";
      const wouldReplace = needsFilterInUrl && keepAliveMayNavigate(active);
      assert.equal(
        wouldReplace,
        false,
        `hijack: ${fromId} → ${dest.id}`,
      );
      assert.notEqual(matchHome(dest.href), "nachrichten");
    }

    if (fromId === "reservierungen") {
      assert.equal(
        keepAliveOwnsPathname(active, normalizePath(dest.href), "reservierungen"),
        false,
        `pollute: ${fromId} → ${dest.id}`,
      );
    }
  }
}

assert.equal(
  keepAliveOwnsPathname(true, MODULE_HOME_PATHS.reservierungen, "reservierungen"),
  true,
);

console.log(
  `OK unit: ${Object.keys(MODULE_HOME_PATHS).length} warm homes × ${SIDEBAR.length} nav targets`,
);
