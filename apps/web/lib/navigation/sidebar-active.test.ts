import assert from "node:assert/strict";
import { test } from "node:test";

import { SIDEBAR_MODULE_DEFINITIONS } from "../constants/sidebar-modules.ts";
import {
  isSidebarDashboardActive,
  isSidebarModuleActive,
} from "./sidebar-active.ts";

test("dashboard active on home path", () => {
  assert.equal(isSidebarDashboardActive("/dashboard", null), true);
  assert.equal(isSidebarDashboardActive("/dashboard/", null), true);
});

test("dashboard active while soft-nav back from module", () => {
  assert.equal(
    isSidebarDashboardActive(
      "/dashboard/kontakte/nachrichten",
      "/dashboard",
    ),
    true,
  );
  assert.equal(
    isSidebarModuleActive(
      "/dashboard/kontakte/nachrichten",
      "/dashboard",
      SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "kontakte")!,
    ),
    false,
  );
});

test("module active while soft-nav away from dashboard", () => {
  assert.equal(
    isSidebarDashboardActive("/dashboard", "/dashboard/menu/uebersicht"),
    false,
  );
  const menu = SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "menu")!;
  assert.equal(
    isSidebarModuleActive("/dashboard", "/dashboard/menu/uebersicht", menu),
    true,
  );
});

test("only matching module active on module path", () => {
  const menu = SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "menu")!;
  const kontakte = SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "kontakte")!;
  assert.equal(
    isSidebarModuleActive("/dashboard/menu/uebersicht", null, menu),
    true,
  );
  assert.equal(
    isSidebarModuleActive("/dashboard/menu/uebersicht", null, kontakte),
    false,
  );
});
