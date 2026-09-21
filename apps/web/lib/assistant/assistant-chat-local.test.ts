import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeAssistantThreadLists,
  titleFromAssistantMessage,
} from "./assistant-chat-local";

test("mergeAssistantThreadLists prefers newer updated_at", () => {
  const merged = mergeAssistantThreadLists(
    [
      {
        id: "a",
        title: "Server",
        updated_at: "2026-09-21T12:00:00.000Z",
      },
    ],
    [
      {
        id: "a",
        title: "Local",
        updated_at: "2026-09-21T13:00:00.000Z",
        messages: [],
      },
      {
        id: "b",
        title: "Only local",
        updated_at: "2026-09-21T11:00:00.000Z",
        messages: [],
      },
    ],
  );
  assert.equal(merged[0]?.id, "a");
  assert.equal(merged[0]?.title, "Local");
  assert.equal(merged.some((t) => t.id === "b"), true);
});

test("titleFromAssistantMessage truncates", () => {
  assert.equal(titleFromAssistantMessage("Hi"), "Hi");
  assert.ok(titleFromAssistantMessage("x".repeat(60)).endsWith("…"));
});
