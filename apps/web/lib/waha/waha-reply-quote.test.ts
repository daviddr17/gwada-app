import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWahaReplyQuote } from "@/lib/waha/waha-reply-quote";

describe("parseWahaReplyQuote", () => {
  it("reads top-level replyTo", () => {
    const quote = parseWahaReplyQuote({
      id: "true_1@c.us_AAA",
      replyTo: {
        id: "false_2@c.us_BBB",
        body: "Check this out!",
      },
    });
    assert.equal(quote?.messageId, "false_2@c.us_BBB");
    assert.equal(quote?.body, "Check this out!");
  });

  it("reads contextInfo from _data", () => {
    const quote = parseWahaReplyQuote({
      id: "true_1@c.us_AAA",
      _data: {
        contextInfo: {
          stanzaId: "ABC123",
          quotedMessage: { conversation: "Hello" },
        },
      },
    });
    assert.equal(quote?.messageId, "ABC123");
    assert.equal(quote?.body, "Hello");
  });
});
