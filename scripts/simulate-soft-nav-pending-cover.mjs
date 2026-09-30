#!/usr/bin/env node
/**
 * Soft-Nav Pending: Cover + Skeleton bis Paint; kein Weißflash / Dashboard-Blitzen.
 */
import assert from "node:assert/strict";

const MODULE_HOME_PATHS = {
  dashboard: "/dashboard",
  reservierungen: "/dashboard/reservations/overview",
  nachrichten: "/dashboard/contacts/messages",
  events: "/dashboard/events/overview",
};

function normalizeNavHref(href) {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

function matchHome(pathname) {
  const path = normalizeNavHref(pathname);
  if (path === MODULE_HOME_PATHS.dashboard) return "dashboard";
  if (path === MODULE_HOME_PATHS.reservierungen) return "reservierungen";
  if (path === MODULE_HOME_PATHS.nachrichten) return "nachrichten";
  if (path === MODULE_HOME_PATHS.events || path === "/dashboard/events") {
    return "events";
  }
  if (path === "/dashboard/menu/overview" || path === "/dashboard/menu") {
    return "menu";
  }
  if (path === "/dashboard/news/overview" || path === "/dashboard/news") {
    return "news";
  }
  return null;
}

/** Cover solange pendingHref gesetzt (auch nach Pathname-Arrive bis Clear). */
function shouldShowPendingCover({ pendingHref, pendingToWarmHome }) {
  if (pendingHref == null || pendingToWarmHome) return false;
  return true;
}

function shouldClearPendingOnPathname({ pendingTarget, pathname }) {
  if (pendingTarget == null) return false;
  const path = normalizeNavHref(pathname);
  const dest = normalizeNavHref(pendingTarget);
  if (path === dest) return true;
  const a = matchHome(path);
  const b = matchHome(dest);
  return a != null && a === b;
}

function slotVisible({ id, pathname, pendingHref, warm, suppressHomeId = null }) {
  const activeHomeId = matchHome(pathname);
  const pendingHomeId = pendingHref != null ? matchHome(pendingHref) : null;
  const pendingNormalized =
    pendingHref != null ? normalizeNavHref(pendingHref) : null;
  const onHome = activeHomeId === id;
  const pendingInFlight = pendingNormalized != null;
  const pendingToThis = warm && pendingHomeId === id && !onHome;
  const showAsSource =
    onHome && !pendingInFlight && suppressHomeId !== id;
  const arrivedPending = onHome && pendingInFlight && pendingHomeId === id;
  return {
    visible: showAsSource || pendingToThis || arrivedPending,
    active: showAsSource,
  };
}

// 1) Dashboard → Speisekarte: Cover + Dashboard weg
{
  const pathname = "/dashboard";
  const pendingHref = "/dashboard/menu/overview";
  assert.equal(
    shouldShowPendingCover({ pendingHref, pendingToWarmHome: false }),
    true,
  );
  const dash = slotVisible({
    id: "dashboard",
    pathname,
    pendingHref,
    warm: true,
  });
  assert.equal(dash.visible, false);
  assert.equal(dash.active, false);
}

// 1b) Warm-Ziel während Pending: Preview sichtbar, Quelle weg
{
  const menu = slotVisible({
    id: "reservierungen",
    pathname: "/dashboard",
    pendingHref: MODULE_HOME_PATHS.reservierungen,
    warm: true,
  });
  assert.equal(menu.visible, true, "Warm-Ziel preview während Pending");
  assert.equal(menu.active, false);
}

// 2) Pathname schon am Ziel, Pending noch gesetzt (pre-paint): Cover bleibt, Dashboard weg
{
  const pathname = "/dashboard/menu/overview";
  const pendingHref = "/dashboard/menu/overview";
  assert.equal(
    shouldShowPendingCover({ pendingHref, pendingToWarmHome: false }),
    true,
    "Cover bis Clear nach Paint",
  );
  assert.equal(
    shouldClearPendingOnPathname({
      pendingTarget: pendingHref,
      pathname,
    }),
    true,
  );
  assert.equal(
    slotVisible({
      id: "dashboard",
      pathname: "/dashboard",
      pendingHref,
      warm: true,
    }).visible,
    false,
    "Dashboard bleibt versteckt solange Pending (auch bei Pathname-Revert)",
  );
}

// 2b) Ziel-Home nach Arrive, Pending noch gesetzt: sichtbar (Chrome/Chips), nicht aktiv
{
  const menu = slotVisible({
    id: "reservierungen",
    pathname: MODULE_HOME_PATHS.reservierungen,
    pendingHref: MODULE_HOME_PATHS.reservierungen,
    warm: true,
  });
  assert.equal(menu.visible, true, "Ziel nach Arrive während Pending sichtbar");
  assert.equal(menu.active, false);
}

// 3) Pathname-Revert während Pending: kein Dashboard-Flash
{
  const dash = slotVisible({
    id: "dashboard",
    pathname: "/dashboard",
    pendingHref: "/dashboard/menu/overview",
    warm: true,
  });
  assert.equal(dash.visible, false, "Revert + Pending → Dashboard hidden");
  assert.equal(
    shouldShowPendingCover({
      pendingHref: "/dashboard/menu/overview",
      pendingToWarmHome: false,
    }),
    true,
  );
}

// 4) Warm Keep-alive Ziel: kein Cover
{
  assert.equal(
    shouldShowPendingCover({
      pendingHref: MODULE_HOME_PATHS.nachrichten,
      pendingToWarmHome: true,
    }),
    false,
  );
}

// 5) Nach Clear: Dashboard wieder normal
{
  const dash = slotVisible({
    id: "dashboard",
    pathname: "/dashboard",
    pendingHref: null,
    warm: true,
  });
  assert.equal(dash.visible, true);
  assert.equal(dash.active, true);
  assert.equal(
    shouldShowPendingCover({ pendingHref: null, pendingToWarmHome: false }),
    false,
  );
}

// 6) Fremder Pathname clear't Pending nicht
{
  assert.equal(
    shouldClearPendingOnPathname({
      pendingTarget: "/dashboard/menu/overview",
      pathname: "/dashboard",
    }),
    false,
  );
}

// 7) Events-Root Redirect: Pending auf /dashboard/events gilt auf Übersicht als angekommen
{
  assert.equal(
    shouldClearPendingOnPathname({
      pendingTarget: "/dashboard/events",
      pathname: "/dashboard/events/overview",
    }),
    true,
    "Events-Root-Redirect räumt Pending",
  );
  assert.equal(
    shouldClearPendingOnPathname({
      pendingTarget: "/dashboard/events",
      pathname: "/dashboard/events/settings",
    }),
    false,
    "Events-Einstellungen ist kein Home-Alias",
  );
}

// 8) Andere Modul-Roots analog (Speisekarte, News)
{
  assert.equal(
    shouldClearPendingOnPathname({
      pendingTarget: "/dashboard/menu",
      pathname: "/dashboard/menu/overview",
    }),
    true,
    "Menu-Root-Redirect räumt Pending",
  );
  assert.equal(
    shouldClearPendingOnPathname({
      pendingTarget: "/dashboard/news",
      pathname: "/dashboard/news/settings",
    }),
    false,
    "News-Einstellungen ist kein Home-Alias",
  );
}

function shouldAbandon({ pathname, pendingFrom, pendingTarget }) {
  if (pendingFrom == null || pendingTarget == null) return false;
  if (shouldClearPendingOnPathname({ pendingTarget, pathname })) return false;
  if (normalizeNavHref(pathname) === normalizeNavHref(pendingFrom)) return false;
  // Anderes Modul-Home = älterer RSC, Pending behalten.
  if (matchHome(pathname) != null) return false;
  return true;
}

function shouldRetryFailsafe({ pathname, pendingFrom, pendingTarget }) {
  if (pendingFrom == null || pendingTarget == null) return false;
  if (shouldClearPendingOnPathname({ pendingTarget, pathname })) return false;
  return normalizeNavHref(pathname) === normalizeNavHref(pendingFrom);
}

function shouldRepush({ pathname, pendingFrom, pendingTarget }) {
  if (pendingFrom == null || pendingTarget == null) return false;
  if (shouldClearPendingOnPathname({ pendingTarget, pathname })) return false;
  if (shouldAbandon({ pathname, pendingFrom, pendingTarget })) return false;
  return true;
}

function shouldClearPendingAfterArrive({ arrivedAt, now, stableMs }) {
  return now - arrivedAt >= stableMs;
}

// 9) Chip Einstellungen während Overview-Flight: Pending aufgeben, kein Retry
{
  assert.equal(
    shouldAbandon({
      pathname: "/dashboard/events/settings",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/events/overview",
    }),
    true,
    "Einstellungen während Events-Flight gibt Pending auf",
  );
  assert.equal(
    shouldRetryFailsafe({
      pathname: "/dashboard/events/settings",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/events/overview",
    }),
    false,
    "Failsafe darf nicht von Einstellungen zurück auf Übersicht pushen",
  );
}

// 10) Hänger auf der Quelle: Failsafe darf retryen
{
  assert.equal(
    shouldRetryFailsafe({
      pathname: "/dashboard",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/menu/overview",
    }),
    true,
  );
  assert.equal(
    shouldAbandon({
      pathname: "/dashboard",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/menu/overview",
    }),
    false,
  );
}

// 11) Älterer Speisekarte-RSC während Events-Pending: nicht aufgeben
{
  assert.equal(
    shouldAbandon({
      pathname: "/dashboard/menu/overview",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/events/overview",
    }),
    false,
    "Stale Speisekarte-RSC darf Events-Pending nicht aufgeben",
  );
}

// 12) Geschluckter Push: noch auf Dashboard → erneut pushen
{
  assert.equal(
    shouldRepush({
      pathname: "/dashboard",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/menu/overview",
    }),
    true,
    "Push geschluckt: Retry von der Quelle",
  );
}

// 13) Stale Speisekarte-RSC während Events-Pending: erneut auf Events pushen
{
  assert.equal(
    shouldRepush({
      pathname: "/dashboard/menu/overview",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/events/overview",
    }),
    true,
    "Stale RSC auf anderem Home → Ziel nachpushen",
  );
}

// 14) Einstellungen: nicht nachpushen (Pending aufgeben)
{
  assert.equal(
    shouldRepush({
      pathname: "/dashboard/events/settings",
      pendingFrom: "/dashboard",
      pendingTarget: "/dashboard/events/overview",
    }),
    false,
    "Einstellungen darf kein Overview-Retry auslösen",
  );
}

// 15) Kurzes Arrive reicht nicht zum Clear — sonst gewinnt der Dashboard-Stream
{
  assert.equal(
    shouldClearPendingAfterArrive({
      arrivedAt: 0,
      now: 32,
      stableMs: 400,
    }),
    false,
    "2 rAF (~32ms) dürfen Pending nicht räumen",
  );
  assert.equal(
    shouldClearPendingAfterArrive({
      arrivedAt: 0,
      now: 400,
      stableMs: 400,
    }),
    true,
  );
}

// 16) Nach Clear ohne Pending: Dashboard wieder sichtbar (kein Source-Guard)
{
  const dash = slotVisible({
    id: "dashboard",
    pathname: "/dashboard",
    pendingHref: null,
    warm: true,
  });
  assert.equal(dash.visible, true, "Nach Clear: Dashboard normal sichtbar");
  assert.equal(dash.active, true);
}

console.log("OK soft-nav pending cover simulation");
