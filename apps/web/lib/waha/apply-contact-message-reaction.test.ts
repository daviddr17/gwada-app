import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyContactMessageReactionEvent } from "@/lib/waha/apply-contact-message-reaction";

describe("applyContactMessageReactionEvent", () => {
  it("adds, replaces, and removes own reaction", () => {
    let list = applyContactMessageReactionEvent([], {
      emoji: "👍",
      fromMe: true,
    });
    assert.deepEqual(list, [{ emoji: "👍", fromMe: true, senderId: undefined }]);

    list = applyContactMessageReactionEvent(list, {
      emoji: "❤️",
      fromMe: true,
    });
    assert.equal(list.length, 1);
    assert.equal(list[0]?.emoji, "❤️");

    list = applyContactMessageReactionEvent(list, {
      emoji: "",
      fromMe: true,
    });
    assert.equal(list.length, 0);
  });

  it("keeps guest and staff reactions separate", () => {
    const list = applyContactMessageReactionEvent(
      [{ emoji: "👍", fromMe: false, senderId: "guest@c.us" }],
      { emoji: "😂", fromMe: true },
    );
    assert.equal(list.length, 2);
  });
});
