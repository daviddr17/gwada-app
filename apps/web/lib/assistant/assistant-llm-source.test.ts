import assert from "node:assert/strict";
import { test } from "node:test";
import { pickAssistantLlm, type AssistantLlmRuntime } from "./assistant-llm-source";
import { restaurantAssistantToPublic } from "../integrations/restaurant-assistant-config";
import {
  assistantAsk,
  firstReservationQuestion,
  resolveReadYmdRange,
  ASSISTANT_LIST_CAP,
} from "./assistant-ask";
import { settleAssistantToolPayloads } from "./assistant-actions";
import {
  ASSISTANT_HISTORY_MAX_MESSAGES,
  ASSISTANT_MAX_TOOL_ROUNDS,
  clipAssistantHistory,
} from "./assistant-chat-limits";

const platform: AssistantLlmRuntime = {
  apiKey: "platform-key",
  model: "gpt-4o-mini",
  provider: "openai",
};
const restaurant: AssistantLlmRuntime = {
  apiKey: "restaurant-key",
  model: "grok-3-mini",
  provider: "grok",
};

test("restaurant chat never uses the platform key", () => {
  const picked = pickAssistantLlm({
    zone: "restaurant",
    callerIsSuperadmin: true,
    platform,
    restaurant,
  });
  assert.equal(picked?.apiKey, "restaurant-key");
  const missing = pickAssistantLlm({
    zone: "restaurant",
    callerIsSuperadmin: true,
    platform,
    restaurant: null,
  });
  assert.equal(missing, null);
});

test("superadmin chat never falls back to a restaurant key", () => {
  const picked = pickAssistantLlm({
    zone: "superadmin",
    callerIsSuperadmin: true,
    platform: null,
    restaurant,
  });
  assert.equal(picked, null);
  const own = pickAssistantLlm({
    zone: "superadmin",
    callerIsSuperadmin: true,
    platform,
    restaurant,
  });
  assert.equal(own?.apiKey, "platform-key");
});

test("public assistant config never returns the key", () => {
  const pub = restaurantAssistantToPublic({
    provider: "grok",
    api_key: "secret-value",
  });
  assert.equal(pub.apiKeyConfigured, true);
  assert.equal(pub.provider, "grok");
  assert.equal("api_key" in pub, false);
  assert.equal(JSON.stringify(pub).includes("secret-value"), false);
});

test("a missing reservation field asks one question and does not guess", () => {
  const gap = firstReservationQuestion(
    { date_ymd: "", time_hm: "19:00", party_size: 2, guest_first_name: "Ana" },
    "de",
  );
  assert.equal(gap?.field, "date_ymd");
  assert.equal(gap?.ask, "Für welchen Tag?");
  assert.equal(assistantAsk("de", "guest"), "Auf welchen Namen?");
});

test("read range defaults to today and rejects a bad date", () => {
  const today = resolveReadYmdRange({ today: "2026-09-30", locale: "de" });
  assert.deepEqual(today, { start: "2026-09-30", end: "2026-09-30" });
  const bad = resolveReadYmdRange({
    today: "2026-09-30",
    dateYmd: "tomorrow",
    locale: "de",
  });
  assert.deepEqual(bad, { ask: "Welches Datum meinst du?" });
  assert.equal(ASSISTANT_LIST_CAP, 8);
});

const draftPayload = JSON.stringify({
  ok: true,
  status: "draft",
  message: "Reservierung am 2026-10-01 um 19:00, 2 Personen, Ana.",
  preview: {
    date_ymd: "2026-10-01",
    time_hm: "19:00",
    party_size: 2,
    guest_first_name: "Ana",
    guest_last_name: null,
    guest_phone: null,
    notes: null,
    restaurant_name: null,
  },
});

test("an open question waits and blocks a guessed save draft", () => {
  const settled = settleAssistantToolPayloads("Ich lege das für heute an.", [
    JSON.stringify({ ok: false, ask: "Für welchen Tag?" }),
    draftPayload,
  ]);
  assert.equal(settled.reply, "Für welchen Tag?");
  assert.equal(settled.pendingAction, null);
});

test("a complete draft is the confirmation text", () => {
  const settled = settleAssistantToolPayloads("Gerne.", [draftPayload]);
  assert.equal(settled.pendingAction?.kind, "create_reservation");
  assert.equal(
    settled.reply,
    "Reservierung am 2026-10-01 um 19:00, 2 Personen, Ana.",
  );
  assert.equal(settled.pendingAction?.preview.guest_first_name, "Ana");
});

const hoursDraftPayload = JSON.stringify({
  ok: true,
  status: "draft",
  message: "Zur Schlagd: Öffnungszeiten ändern — Montag 12:00–22:00.",
  preview: {
    restaurant_name: "Zur Schlagd",
    weekly_changes: [
      {
        weekday: "monday",
        closed: false,
        opens_at: "12:00",
        closes_at: "22:00",
      },
    ],
    exception_changes: [],
    next_weekly: {
      monday: { closed: false, open: "12:00", close: "22:00" },
      tuesday: { closed: false, open: "11:30", close: "22:00" },
      wednesday: { closed: false, open: "11:30", close: "22:00" },
      thursday: { closed: false, open: "11:30", close: "22:00" },
      friday: { closed: false, open: "11:30", close: "22:00" },
      saturday: { closed: false, open: "11:30", close: "22:00" },
      sunday: { closed: true },
    },
    next_exceptions: [],
    kitchenHoursEnabled: false,
    kitchenWeeklyHours: {
      monday: { closed: false, open: "12:00", close: "21:30" },
      tuesday: { closed: false, open: "12:00", close: "21:30" },
      wednesday: { closed: false, open: "12:00", close: "21:30" },
      thursday: { closed: false, open: "12:00", close: "21:30" },
      friday: { closed: false, open: "12:00", close: "21:30" },
      saturday: { closed: false, open: "12:00", close: "21:30" },
      sunday: { closed: true },
    },
  },
});

test("opening-hours draft becomes a pending confirm action", () => {
  const settled = settleAssistantToolPayloads("Ok.", [hoursDraftPayload]);
  assert.equal(settled.pendingAction?.kind, "update_opening_hours");
  assert.equal(
    settled.reply,
    "Zur Schlagd: Öffnungszeiten ändern — Montag 12:00–22:00.",
  );
  if (settled.pendingAction?.kind !== "update_opening_hours") {
    assert.fail("expected update_opening_hours");
  }
  assert.equal(settled.pendingAction.preview.weekly_changes[0]?.weekday, "monday");
});

test("generic mutation draft becomes confirm_mutation", () => {
  const settled = settleAssistantToolPayloads("Ok.", [
    JSON.stringify({
      ok: true,
      status: "draft",
      action: "sync_platforms",
      message:
        "Plattformen synchronisieren (opening_hours, google/facebook). Jetzt umsetzen?",
      preview: { scope: "opening_hours", platforms: ["google", "facebook"] },
    }),
  ]);
  assert.equal(settled.pendingAction?.kind, "confirm_mutation");
  if (settled.pendingAction?.kind !== "confirm_mutation") {
    assert.fail("expected confirm_mutation");
  }
  assert.equal(settled.pendingAction.preview.action, "sync_platforms");
  assert.match(settled.reply, /Jetzt umsetzen\?/);
});

test("history is clipped to keep long threads fast", () => {
  const long = Array.from({ length: ASSISTANT_HISTORY_MAX_MESSAGES + 5 }, (_, i) => ({
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `m${i}`,
  }));
  const clipped = clipAssistantHistory(long);
  assert.equal(clipped.length, ASSISTANT_HISTORY_MAX_MESSAGES);
  assert.equal(clipped[0]?.content, `m${5}`);
  assert.equal(ASSISTANT_MAX_TOOL_ROUNDS, 4);
});

test("menu upsert draft carries recipe confirm summary", () => {
  const settled = settleAssistantToolPayloads("Ok.", [
    JSON.stringify({
      ok: true,
      status: "draft",
      action: "upsert_menu_item",
      message:
        "Gericht anlegen: Schnitzel, 14.50 €, Kategorie Hauptgerichte, Rezept: 0.2× Kalb. Jetzt umsetzen?",
      preview: {
        mode: "create",
        name: "Schnitzel",
        price: 14.5,
        recipe: [{ ingredient: "Kalb", amount: 0.2 }],
      },
    }),
  ]);
  assert.equal(settled.pendingAction?.kind, "confirm_mutation");
  if (settled.pendingAction?.kind !== "confirm_mutation") {
    assert.fail("expected confirm_mutation");
  }
  assert.equal(settled.pendingAction.preview.action, "upsert_menu_item");
});
