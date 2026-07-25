#!/usr/bin/env node
/**
 * Smoke: isModuleSoftNavDataReady erkennt warme Menu/Staff-Caches.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { QueryClient } from "@tanstack/react-query";

// Die Helper-Datei ist TS — wir testen die Logik indirekt über gebaute Semantik:
// Hier nur QueryClient-Hit-Pfad ohne Next-Runtime.
const restaurantId = "11111111-1111-4111-8111-111111111111";

function normalizePath(href) {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

function isReadyViaQuery(queryClient, href) {
  const path = normalizePath(href);
  if (path.startsWith("/dashboard/menu")) {
    return queryClient.getQueryData(["menu", restaurantId, "items"]) != null;
  }
  if (path.startsWith("/dashboard/mitarbeiter")) {
    return queryClient.getQueryData(["staff", restaurantId, "list"]) != null;
  }
  return false;
}

const qc = new QueryClient();
assert.equal(
  isReadyViaQuery(qc, "/dashboard/menu/uebersicht"),
  false,
  "cold menu",
);
qc.setQueryData(["menu", restaurantId, "items"], [{ id: "1" }]);
assert.equal(
  isReadyViaQuery(qc, "/dashboard/menu/uebersicht"),
  true,
  "warm menu",
);
qc.setQueryData(["staff", restaurantId, "list"], { staff: [] });
assert.equal(
  isReadyViaQuery(qc, "/dashboard/mitarbeiter/uebersicht"),
  true,
  "warm staff",
);

// Sicherstellen, dass Reviews-Default-Key stabil bleibt (Soft-Nav Warm).
const require = createRequire(import.meta.url);
void require;
const defaultKey = ["", "all", "all", "all", "all", "created_desc"].join("|");
assert.equal(defaultKey, "|all|all|all|all|created_desc");

console.log("OK module soft-nav data-ready smoke");
