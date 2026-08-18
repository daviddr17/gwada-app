#!/usr/bin/env node
/**
 * Soft-Nav Pending: Cover + Skeleton bis Paint; kein Weißflash / Dashboard-Blitzen.
 */
import assert from "node:assert/strict";

const MODULE_HOME_PATHS = {
  dashboard: "/dashboard",
  reservierungen: "/dashboard/reservierungen/uebersicht",
  nachrichten: "/dashboard/kontakte/nachrichten",
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
  return null;
}

/** Cover solange pendingHref gesetzt (auch nach Pathname-Arrive bis Clear). */
function shouldShowPendingCover({ pendingHref, pendingToWarmHome }) {
  if (pendingHref == null || pendingToWarmHome) return false;
  return true;
}

function shouldClearPendingOnPathname({ pendingTarget, pathname }) {
  if (pendingTarget == null) return false;
  return normalizeNavHref(pathname) === pendingTarget;
}

function slotVisible({ id, pathname, pendingHref, warm }) {
  const activeHomeId = matchHome(pathname);
  const pendingHomeId = pendingHref != null ? matchHome(pendingHref) : null;
  const pendingNormalized =
    pendingHref != null ? normalizeNavHref(pendingHref) : null;
  const onHome = activeHomeId === id;
  const pendingInFlight = pendingNormalized != null;
  const pendingToThis = warm && pendingHomeId === id && !onHome;
  const showAsSource = onHome && !pendingInFlight;
  const arrivedPending = onHome && pendingInFlight && pendingHomeId === id;
  return {
    visible: showAsSource || pendingToThis || arrivedPending,
    active: showAsSource,
  };
}

// 1) Dashboard → Speisekarte: Cover + Dashboard weg
{
  const pathname = "/dashboard";
  const pendingHref = "/dashboard/menu/uebersicht";
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
  const pathname = "/dashboard/menu/uebersicht";
  const pendingHref = "/dashboard/menu/uebersicht";
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
    pendingHref: "/dashboard/menu/uebersicht",
    warm: true,
  });
  assert.equal(dash.visible, false, "Revert + Pending → Dashboard hidden");
  assert.equal(
    shouldShowPendingCover({
      pendingHref: "/dashboard/menu/uebersicht",
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
      pendingTarget: "/dashboard/menu/uebersicht",
      pathname: "/dashboard",
    }),
    false,
  );
}

console.log("OK soft-nav pending cover simulation");
