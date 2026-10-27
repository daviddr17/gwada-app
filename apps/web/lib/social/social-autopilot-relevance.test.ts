import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSocialAutopilotIdeaId,
  socialAutopilotIdeaId,
} from "./social-autopilot-ideas";
import {
  contentReasonFromSuggestion,
  filterRelevantHolidays,
  isEventRelevantSoon,
  rotateBySeed,
} from "./social-autopilot-relevance";

test("filterRelevantHolidays drops far-away holidays like Assumption outside window", () => {
  const now = new Date("2026-10-26T12:00:00");
  const holidays = [
    { date: "2026-08-15", name: "Mariä Himmelfahrt" },
    { date: "2026-10-31", name: "Reformationstag" },
    { date: "2026-10-28", name: "Nahe Feier" },
    { date: "2026-10-20", name: "Vergangen" },
  ];
  const out = filterRelevantHolidays(holidays, {
    now,
    lookaheadDays: 5,
    maxSlots: 1,
  });
  assert.deepEqual(out, [{ date: "2026-10-28", name: "Nahe Feier" }]);
});

test("filterRelevantHolidays respects maxSlots and sorts by date", () => {
  const now = new Date("2026-10-26T12:00:00");
  const out = filterRelevantHolidays(
    [
      { date: "2026-10-30", name: "B" },
      { date: "2026-10-27", name: "A" },
      { date: "2026-10-29", name: "C" },
    ],
    { now, lookaheadDays: 5, maxSlots: 2 },
  );
  assert.equal(out.length, 2);
  assert.equal(out[0]?.name, "A");
  assert.equal(out[1]?.name, "C");
});

test("isEventRelevantSoon accepts near events and rejects far ones", () => {
  const now = new Date("2026-10-26T12:00:00");
  assert.equal(
    isEventRelevantSoon("2026-11-02T18:00:00.000Z", { now, lookaheadDays: 14 }),
    true,
  );
  assert.equal(
    isEventRelevantSoon("2026-12-24T18:00:00.000Z", { now, lookaheadDays: 14 }),
    false,
  );
});

test("rotateBySeed changes order deterministically", () => {
  const items = ["a", "b", "c", "d"];
  const a = rotateBySeed(items, "seed-1");
  const b = rotateBySeed(items, "seed-1");
  const c = rotateBySeed(items, "seed-2");
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.notDeepEqual(a, items);
  // Different seeds usually differ; if equal, still a valid rotation.
  assert.equal(c.length, 4);
});

test("socialAutopilotIdeaId round-trips through parse", () => {
  const id = socialAutopilotIdeaId("menu", "abc-123");
  assert.equal(id, "menu:abc-123");
  assert.deepEqual(parseSocialAutopilotIdeaId(id), {
    kind: "menu_dish",
    ref: "abc-123",
  });
  assert.equal(parseSocialAutopilotIdeaId("nope"), null);
});

test("contentReasonFromSuggestion maps slot to restaurant content labels", () => {
  const dish = contentReasonFromSuggestion({
    slotKind: "menu_dish",
    title: "Schnitzel",
    source: { dishName: "Wiener Schnitzel" },
  });
  assert.equal(dish.label, "Speisekarte");
  assert.equal(dish.detail, "Wiener Schnitzel");

  const holiday = contentReasonFromSuggestion({
    slotKind: "holiday",
    title: "X",
    source: { holidayName: "Nahe Feier", date: "2026-10-28" },
  });
  assert.equal(holiday.label, "Naher Feiertag");
  assert.match(holiday.detail, /Nahe Feier/);
});
