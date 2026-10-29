import assert from "node:assert/strict";
import { test } from "node:test";

import {
  restaurantMcpToolByName,
  restaurantMcpToolListItems,
  restaurantMcpToolsForEnabledModules,
  RESTAURANT_MCP_TOOLS,
} from "./restaurant-mcp-tools";
import { RESTAURANT_API_MODULE_IDS } from "./restaurant-api-modules";

test("every MCP tool maps to a known API module", () => {
  for (const tool of RESTAURANT_MCP_TOOLS) {
    assert.ok(
      (RESTAURANT_API_MODULE_IDS as readonly string[]).includes(tool.moduleId),
      `unknown module ${tool.moduleId} on ${tool.name}`,
    );
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.name.length > 0);
  }
});

test("tools/list filters by enabled_modules like REST scopes", () => {
  const onlyMenu = restaurantMcpToolsForEnabledModules(["menu"]);
  assert.deepEqual(
    onlyMenu.map((t) => t.name),
    ["get_menu"],
  );

  const menuAndReservation = restaurantMcpToolListItems([
    "menu",
    "reservation",
  ]);
  const names = menuAndReservation.map((t) => t.name);
  assert.ok(names.includes("get_menu"));
  assert.ok(names.includes("get_reservation_config"));
  assert.ok(names.includes("create_reservation"));
  assert.ok(names.includes("manage_reservation"));
  assert.ok(!names.includes("get_reviews"));
  assert.ok(!names.includes("get_purchase_orders"));
});

test("purchase_orders is opt-in and not requirePublished", () => {
  const tool = restaurantMcpToolByName("get_purchase_orders");
  assert.ok(tool);
  assert.equal(tool!.moduleId, "purchase_orders");
  assert.equal(tool!.requirePublished, false);

  const none = restaurantMcpToolsForEnabledModules(["menu"]);
  assert.ok(!none.some((t) => t.name === "get_purchase_orders"));

  const withPo = restaurantMcpToolsForEnabledModules(["purchase_orders"]);
  assert.equal(withPo.length, 1);
  assert.equal(withPo[0]!.name, "get_purchase_orders");
});

test("empty enabled_modules yields no tools", () => {
  assert.deepEqual(restaurantMcpToolsForEnabledModules([]), []);
});

test("unknown tool name returns null", () => {
  assert.equal(restaurantMcpToolByName("does_not_exist"), null);
});
