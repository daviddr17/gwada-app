#!/usr/bin/env node
/**
 * Simuliert Soft-Nav von jedem Keep-alive-Home zu jedem Sidebar-Modul.
 * Stellt sicher: inactive Keep-alive darf Ziel-URL nicht zurückreißen.
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
  const path = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

function matchHome(pathname) {
  const path = normalizePath(pathname);
  if (path === MODULE_HOME_PATHS.dashboard) return "dashboard";
  if (path === MODULE_HOME_PATHS.reservierungen) return "reservierungen";
  if (path === MODULE_HOME_PATHS.nachrichten) return "nachrichten";
  return null;
}

function keepAliveMayNavigate(active) {
  return active === true;
}

function keepAliveOwnsPathname(active, pathname, id) {
  return keepAliveMayNavigate(active) && matchHome(pathname) === id;
}

/** Nachrichtenen Effect: fehlendes platform → replace Inbox (der Bug). */
function nachrichtenWouldHijack(active, destHref) {
  const destPath = normalizePath(destHref);
  if (matchHome(destPath) === "nachrichten") return false;
  const platformParam = null; // fremde Module haben typisch kein platform=
  const next = "all";
  const needsFilterInUrl = platformParam !== next;
  return needsFilterInUrl && keepAliveMayNavigate(active);
}

/** Reservierungen Drawer-Close nach Soft-Nav. */
function reservierungenWouldPollute(active, destHref) {
  return keepAliveOwnsPathname(
    active,
    normalizePath(destHref),
    "reservierungen",
  );
}

let failures = 0;

for (const fromId of Object.keys(MODULE_HOME_PATHS)) {
  for (const dest of SIDEBAR) {
    const destPath = normalizePath(dest.href);
    // Nach Soft-Nav ist das Quell-Keep-alive warm aber inactive
    const active = false;

    if (fromId === "nachrichten") {
      const hijack = nachrichtenWouldHijack(active, dest.href);
      if (hijack) {
        failures += 1;
        console.error(
          `FAIL nachrichten → ${dest.id}: URL-sync würde zurückreißen`,
        );
      }
    }

    if (fromId === "reservierungen") {
      const pollute = reservierungenWouldPollute(active, dest.href);
      // pollute true means clearReservationUrl WOULD mutate dest — bad unless dest is reservierungen
      if (pollute && destPath !== MODULE_HOME_PATHS.reservierungen) {
        failures += 1;
        console.error(
          `FAIL reservierungen → ${dest.id}: Drawer-close würde URL polluten`,
        );
      }
      if (
        destPath !== MODULE_HOME_PATHS.reservierungen &&
        keepAliveOwnsPathname(false, destPath, "reservierungen")
      ) {
        failures += 1;
        console.error(
          `FAIL reservierungen ownership on ${dest.id} while inactive`,
        );
      }
    }

    // Ziel darf nicht fälschlich als Nachrichten landen (außer kontakte)
    if (dest.id !== "kontakte" && matchHome(destPath) === "nachrichten") {
      failures += 1;
      console.error(`FAIL ${dest.id} href matched nachrichten home`);
    }
  }
}

// Positive: aktiv auf eigenem Home darf navigieren
assert.equal(
  keepAliveOwnsPathname(true, MODULE_HOME_PATHS.reservierungen, "reservierungen"),
  true,
);
assert.equal(keepAliveMayNavigate(true), true);

if (failures > 0) {
  console.error(`${failures} Soft-Nav Keep-alive Simulation(en) fehlgeschlagen`);
  process.exit(1);
}

console.log(
  `OK Soft-Nav Keep-alive: ${Object.keys(MODULE_HOME_PATHS).length} Homes × ${SIDEBAR.length} Sidebar-Ziele`,
);
