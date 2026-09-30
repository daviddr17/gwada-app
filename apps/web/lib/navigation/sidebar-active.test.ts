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
      "/dashboard/contacts/messages",
      "/dashboard",
    ),
    true,
  );
  assert.equal(
    isSidebarModuleActive(
      "/dashboard/contacts/messages",
      "/dashboard",
      SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "kontakte")!,
    ),
    false,
  );
});

test("module active while soft-nav away from dashboard", () => {
  assert.equal(
    isSidebarDashboardActive("/dashboard", "/dashboard/menu/overview"),
    false,
  );
  const menu = SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "menu")!;
  assert.equal(
    isSidebarModuleActive("/dashboard", "/dashboard/menu/overview", menu),
    true,
  );
});

test("only matching module active on module path", () => {
  const menu = SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "menu")!;
  const kontakte = SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "kontakte")!;
  assert.equal(
    isSidebarModuleActive("/dashboard/menu/overview", null, menu),
    true,
  );
  assert.equal(
    isSidebarModuleActive("/dashboard/menu/overview", null, kontakte),
    false,
  );
});
