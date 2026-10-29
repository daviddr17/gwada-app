import assert from "node:assert/strict";
import { test } from "node:test";

import { filterPersonalReminderPushTargets } from "./notification-personal-reminder-targets.ts";

test("Push nur an Notiz-Eigentümer", () => {
  const targets = [
    { profileId: "u1", restaurantId: "r1" },
    { profileId: "u2", restaurantId: "r1" },
  ];
  assert.deepEqual(
    filterPersonalReminderPushTargets(
      { payload: { targetProfileId: "u2" } },
      targets,
    ),
    [{ profileId: "u2", restaurantId: "r1" }],
  );
  assert.deepEqual(
    filterPersonalReminderPushTargets({ payload: {} }, targets),
    [],
  );
});
