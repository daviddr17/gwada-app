import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_CONNECT_HISTORY_THREAD_LIMIT,
  META_DAILY_SYNC_THREAD_LIMIT,
  META_MESSAGES_PER_THREAD,
} from "./meta-inbox-sync-limits.ts";

describe("meta inbox sync limits", () => {
  it("loads about 20 chats on connect and daily", () => {
    assert.equal(META_CONNECT_HISTORY_THREAD_LIMIT, 20);
    assert.equal(META_DAILY_SYNC_THREAD_LIMIT, 20);
    assert.ok(META_MESSAGES_PER_THREAD >= 20);
  });
});
