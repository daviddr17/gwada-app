import assert from "node:assert/strict";
import { test } from "node:test";

import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import { NOTIFICATION_SETTINGS_GROUPS } from "@/lib/notifications/notification-module-groups";
import { defaultInAppModuleToggles } from "@/lib/notifications/notification-preferences";

test("Pause-Module stehen in den Einstellungen und sind standardmäßig aus", () => {
  const staff = NOTIFICATION_SETTINGS_GROUPS.find((group) => group.id === "staff");
  assert.ok(staff);
  assert.ok(staff.moduleIds.includes("staff_display_break_start"));
  assert.ok(staff.moduleIds.includes("staff_display_break_end"));

  const toggles = defaultInAppModuleToggles();
  assert.equal(toggles.staff_display_break_start, false);
  assert.equal(toggles.staff_display_break_end, false);
  assert.equal(toggles.staff_display_clock_in, false);
});

test("Heute-Feed beschreibt Pause als Klartext, nicht als JSON", () => {
  const started = liveActivityFromNotificationEvent({
    eventId: "evt-1",
    referenceId: "entry-1",
    module: "staff_display_break_start",
    payload: {
      staffName: "Mara Klein",
      staffId: "staff-1",
      entryId: "entry-1",
      shiftId: "shift-1",
      action: "start_break",
      at: "2026-09-21T10:00:00.000Z",
    },
    createdAt: "2026-09-21T10:00:00.000Z",
  });
  assert.equal(started.title, "Mara Klein · Pause gestartet");
  assert.equal(started.description, "Hat die Pause am Display gestartet");
  assert.equal(started.description?.includes("{"), false);

  const ended = liveActivityFromNotificationEvent({
    eventId: "evt-2",
    referenceId: "entry-1",
    module: "staff_display_break_end",
    payload: {
      staffName: "Mara Klein",
      staffId: "staff-1",
      entryId: "entry-1",
      action: "end_break",
      at: "2026-09-21T10:20:00.000Z",
    },
    createdAt: "2026-09-21T10:20:00.000Z",
  });
  assert.equal(ended.title, "Mara Klein · Pause beendet");
  assert.equal(ended.description, "Hat die Pause am Display beendet");
});
