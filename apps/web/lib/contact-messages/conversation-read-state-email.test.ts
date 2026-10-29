import assert from "node:assert/strict";
import test from "node:test";
import { computeConversationUnread } from "./conversation-read-state.ts";

test("email personalReadOnly ignores communal and external unread", () => {
  const result = computeConversationUnread({
    read: undefined,
    conversation: {
      last_at: "2026-10-29T12:00:00.000Z",
      last_direction: "inbound",
      inbound_count: 2,
      external_unread_count: 0,
    },
    communal_read_at: "2026-10-29T13:00:00.000Z",
    personalReadOnly: true,
  });
  assert.equal(result.is_unread, true);
  assert.equal(result.unread_count, 2);
  assert.equal(result.unread_hint, "channel");
});

test("email personalReadOnly clears when this user read", () => {
  const result = computeConversationUnread({
    read: {
      conversation_key: "c1",
      platform: "email",
      last_read_at: "2026-10-29T13:00:00.000Z",
      marked_unread_at: null,
    },
    conversation: {
      last_at: "2026-10-29T12:00:00.000Z",
      last_direction: "inbound",
      inbound_count: 2,
      external_unread_count: 5,
    },
    communal_read_at: null,
    personalReadOnly: true,
  });
  assert.equal(result.is_unread, false);
  assert.equal(result.unread_count, 0);
});
