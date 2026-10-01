import assert from "node:assert/strict";
import { test } from "node:test";

import {
  liveActivityPayloadVisibleToViewer,
  liveFeedModulesForViewer,
  viewerHasFullLiveFeedAccess,
} from "@/lib/live-activity/live-activity-feed-access";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

function allow(...keys: RestaurantPermissionKey[]) {
  const set = new Set(keys);
  return (key: RestaurantPermissionKey) => set.has(key);
}

test("voller Zugriff und Inhaber sehen jedes Feed-Modul", () => {
  const has = allow(
    "contacts.read",
    "reviews.read",
    "reservations.read",
    "events.read",
    "staff.read",
    "staff_todos.read",
    "inventory.read",
    "accounting.read",
  );
  assert.equal(viewerHasFullLiveFeedAccess(has), true);
  const modules = liveFeedModulesForViewer(
    { has, hasStaffProfile: false },
    { unrestricted: true },
  );
  assert.equal(modules.includes("accounting_voucher"), true);
  assert.equal(modules.includes("staff_display_clock_out"), true);
  assert.equal(modules.includes("staff_contract_signed"), true);
});

test("ohne Buchführung keine Belege, ohne Personal keine Stempel", () => {
  const modules = liveFeedModulesForViewer({
    has: allow("inventory.read"),
    hasStaffProfile: true,
  });
  assert.equal(modules.includes("inventory_low_stock"), true);
  assert.equal(modules.includes("accounting_voucher"), false);
  assert.equal(modules.includes("staff_display_clock_out"), false);
  assert.equal(modules.includes("staff_shift_start"), true);
});

test("eigene Schicht und fremder Vertrag bleiben verborgen", () => {
  const viewer = {
    userId: "user-1",
    viewerStaffId: "staff-1",
    shiftScope: "own" as const,
    unrestricted: false,
  };
  assert.equal(
    liveActivityPayloadVisibleToViewer({
      ...viewer,
      module: "staff_shift_start",
      payload: { staffId: "staff-2", assignedProfileId: "user-2" },
    }),
    false,
  );
  assert.equal(
    liveActivityPayloadVisibleToViewer({
      ...viewer,
      module: "staff_shift_end",
      payload: { staffId: "staff-1" },
    }),
    true,
  );
  assert.equal(
    liveActivityPayloadVisibleToViewer({
      ...viewer,
      module: "staff_contract_signed",
      payload: { targetProfileId: "user-2" },
    }),
    false,
  );
  assert.equal(
    liveActivityPayloadVisibleToViewer({
      ...viewer,
      module: "accounting_voucher",
      payload: { createdByProfileId: "user-2" },
    }),
    true,
  );
});

test("voller Zugriff sieht auch fremde persönliche Zeilen", () => {
  assert.equal(
    liveActivityPayloadVisibleToViewer({
      module: "staff_permissions_granted",
      payload: { targetProfileId: "user-2" },
      userId: "user-1",
      viewerStaffId: null,
      shiftScope: "own",
      unrestricted: true,
    }),
    true,
  );
});
