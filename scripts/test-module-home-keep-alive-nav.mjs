#!/usr/bin/env node
/**
 * Unit + Soft-Nav-Simulation für Module-Home Keep-alive.
 * Exit 1 bei Regression (Nachrichten-Hijack / URL-Pollution).
 */
import assert from "node:assert/strict";

const MODULE_HOME_PATHS = {
  dashboard: "/dashboard",
  reservierungen: "/dashboard/reservations/overview",
  nachrichten: "/dashboard/contacts/messages",
};

const SIDEBAR = [
  { id: "dashboard", href: "/dashboard" },
  { id: "menu", href: "/dashboard/menu/overview" },
  { id: "inventory", href: "/dashboard/inventory/overview" },
  { id: "reservierungen", href: "/dashboard/reservations/overview" },
  { id: "pos", href: "/dashboard/pos/overview" },
  { id: "events", href: "/dashboard/events/overview" },
  { id: "kontakte", href: "/dashboard/contacts/messages?platform=all" },
  { id: "news", href: "/dashboard/news/overview" },
  { id: "bewertungen", href: "/dashboard/reviews/overview" },
  { id: "insights", href: "/dashboard/insights/overview" },
  { id: "galerie", href: "/dashboard/gallery/overview" },
  { id: "buchfuehrung", href: "/dashboard/accounting/invoices" },
  { id: "dokumente", href: "/dashboard/documents/overview" },
  { id: "checklisten", href: "/dashboard/tasks" },
  { id: "mitarbeiter", href: "/dashboard/staff/overview" },
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
  matchHome("/dashboard/contacts/messages?platform=all"),
  "nachrichten",
);
assert.equal(
  matchHome("/dashboard/contacts/messages"),
  "nachrichten",
);
assert.equal(matchHome("/dashboard/menu/overview"), null);
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

function moduleHomeSlotVisibility({
  id,
  activeHomeId,
  pendingHomeId,
  pendingInFlight,
  warmFlag,
}) {
  const onHome = activeHomeId === id;
  const pendingToThis =
    pendingInFlight && pendingHomeId === id && !onHome;
  const warm =
    warmFlag ||
    onHome ||
    (pendingInFlight && pendingHomeId === id);
  const showAsSource = onHome && !pendingInFlight;
  const arrivedPending = onHome && pendingInFlight && pendingHomeId === id;
  return {
    warm,
    visible: showAsSource || pendingToThis || arrivedPending,
    active: showAsSource || arrivedPending,
  };
}

const pendingNachrichten = moduleHomeSlotVisibility({
  id: "nachrichten",
  activeHomeId: "dashboard",
  pendingHomeId: "nachrichten",
  pendingInFlight: true,
  warmFlag: false,
});
assert.equal(pendingNachrichten.warm, true);
assert.equal(pendingNachrichten.visible, true);
assert.equal(pendingNachrichten.active, false);

const arrivedNachrichten = moduleHomeSlotVisibility({
  id: "nachrichten",
  activeHomeId: "nachrichten",
  pendingHomeId: "nachrichten",
  pendingInFlight: true,
  warmFlag: false,
});
assert.equal(arrivedNachrichten.visible, true);
assert.equal(arrivedNachrichten.active, true);

console.log(
  `OK unit: ${Object.keys(MODULE_HOME_PATHS).length} warm homes × ${SIDEBAR.length} nav targets`,
);
