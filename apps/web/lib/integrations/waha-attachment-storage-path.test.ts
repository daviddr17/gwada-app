import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseWahaAttachmentStoragePath,
  wahaAttachmentStoragePath,
} from "@/lib/contact-messages/waha-attachment-storage-path";
import { attachmentUrlFromStoragePath } from "@/lib/contact-messages/contact-message-attachment-urls";

describe("waha attachment storage path", () => {
  it("round-trips chatId and messageId", () => {
    const path = wahaAttachmentStoragePath(
      "491701234567@c.us",
      "true_123@c.us_ABC",
    );
    assert.deepEqual(parseWahaAttachmentStoragePath(path), {
      chatId: "491701234567@c.us",
      messageId: "true_123@c.us_ABC",
    });
  });

  it("builds media proxy URL from storage path", () => {
    const path = wahaAttachmentStoragePath("chat@c.us", "msg-1");
    const url = attachmentUrlFromStoragePath({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      messageId: "22222222-2222-2222-2222-222222222222",
      attachmentId: "33333333-3333-3333-3333-333333333333",
      storagePath: path,
    });
    assert.match(url, /\/api\/contact-messages\/waha\/media\?/);
    assert.match(url, /chatId=chat%40c\.us/);
    assert.match(url, /messageId=msg-1/);
  });
});
