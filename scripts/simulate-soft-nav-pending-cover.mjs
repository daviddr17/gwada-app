#!/usr/bin/env node
/**
 * Soft-Nav Pending: Titel/Chrome darf nie über sichtbarem Quell-Keep-alive liegen.
 * Reproduziert Dashboard → Modul mit warmem Cache (früher: Overlay return null).
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

/** Spiegel von SoftNavPendingOverlay-Entscheidung (nach Fix). */
function shouldShowPendingCover({
  pathname,
  pendingHref,
  pendingToWarmHome,
}) {
  const pending =
    pendingHref != null &&
    normalizeNavHref(pendingHref) !== normalizeNavHref(pathname);
  if (!pending || !pendingHref || pendingToWarmHome) return false;
  return true;
}

/** Spiegel Keep-alive Slot-Visibility (nach Fix). */
function slotVisible({
  id,
  pathname,
  pendingHref,
  warm,
}) {
  const activeHomeId = matchHome(pathname);
  const pendingHomeId = pendingHref != null ? matchHome(pendingHref) : null;
  const pendingNormalized =
    pendingHref != null ? normalizeNavHref(pendingHref) : null;
  const onHome = activeHomeId === id;
  const pendingAway =
    pendingNormalized != null &&
    pendingNormalized !== normalizeNavHref(pathname);
  const pendingToThis =
    warm &&
    pendingHomeId === id &&
    pendingNormalized === MODULE_HOME_PATHS[id] &&
    !onHome;
  const showAsSource = onHome && !pendingAway;
  return {
    visible: showAsSource || pendingToThis,
    active: showAsSource,
  };
}

// 1) Dashboard → Speisekarte (warm cache): Cover muss an, Dashboard muss weg
{
  const pathname = "/dashboard";
  const pendingHref = "/dashboard/menu/uebersicht";
  assert.equal(
    shouldShowPendingCover({
      pathname,
      pendingHref,
      pendingToWarmHome: false,
    }),
    true,
    "warm Speisekarte: Cover muss Quell-Dashboard decken",
  );
  const dash = slotVisible({
    id: "dashboard",
    pathname,
    pendingHref,
    warm: true,
  });
  assert.equal(dash.visible, false, "Dashboard-Slot muss bei Pending weg");
  assert.equal(dash.active, false, "Dashboard darf nicht active bleiben");
}

// 2) Warm Keep-alive Ziel (Nachrichten): Cover aus, Ziel-Preview an
{
  const pathname = "/dashboard";
  const pendingHref = MODULE_HOME_PATHS.nachrichten;
  assert.equal(
    shouldShowPendingCover({
      pathname,
      pendingHref,
      pendingToWarmHome: true,
    }),
    false,
    "warm Keep-alive Ziel: Cover unnötig",
  );
  const target = slotVisible({
    id: "nachrichten",
    pathname,
    pendingHref,
    warm: true,
  });
  assert.equal(target.visible, true, "Nachrichten-Preview sichtbar");
  const dash = slotVisible({
    id: "dashboard",
    pathname,
    pendingHref,
    warm: true,
  });
  assert.equal(dash.visible, false, "Dashboard bei Pending zu Nachrichten weg");
}

// 3) Kein Pending: Dashboard normal
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
    shouldShowPendingCover({
      pathname: "/dashboard",
      pendingHref: null,
      pendingToWarmHome: false,
    }),
    false,
  );
}

// 4) Doppel-Acquire: zweiter Klick gleiches Ziel → kein push
{
  let pending = null;
  function tryAcquire(targetHref) {
    const target = normalizeNavHref(targetHref);
    if (pending === target) return false;
    pending = target;
    return true;
  }
  assert.equal(tryAcquire("/dashboard/menu/uebersicht"), true);
  assert.equal(
    tryAcquire("/dashboard/menu/uebersicht"),
    false,
    "kein zweites push auf gleiches Ziel",
  );
  assert.equal(tryAcquire("/dashboard/inventory/uebersicht"), true);
  assert.equal(pending, "/dashboard/inventory/uebersicht");
}

console.log("OK soft-nav pending cover simulation");
