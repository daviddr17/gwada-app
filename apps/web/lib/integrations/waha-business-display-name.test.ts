import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayNameFromChatOverview,
  displayNameFromWahaContactInfo,
  extractWahaBusinessDisplayName,
  needsWahaDisplayNameResolve,
  pickWahaChatReadableTitle,
  wahaChatListDisplayName,
} from "@/lib/contact-messages/waha-chat-label";

describe("extractWahaBusinessDisplayName", () => {
  it("prefers verifiedBizName from NOWEB message _data", () => {
    assert.equal(
      extractWahaBusinessDisplayName({
        pushName: "Someone",
        verifiedBizName: "Sb Union",
      }),
      "Sb Union",
    );
  });

  it("ignores phone-like business fields", () => {
    assert.equal(
      extractWahaBusinessDisplayName({
        verifiedBizName: "+49 566172321",
        businessName: "49566172321",
      }),
      null,
    );
  });
});

describe("displayNameFromChatOverview", () => {
  it("reads verifiedBizName from lastMessage._data", () => {
    assert.equal(
      displayNameFromChatOverview({
        id: "49566172321@c.us",
        name: null,
        lastMessage: {
          body: "Bild",
          _data: { verifiedBizName: "Sb Union", pushName: "x" },
        },
      }),
      "Sb Union",
    );
  });

  it("does not treat chat id / phone as a readable title", () => {
    assert.equal(
      displayNameFromChatOverview({
        id: "49566172321@c.us",
        name: "+49 566172321",
      }),
      null,
    );
  });
});

describe("displayNameFromWahaContactInfo", () => {
  it("prefers verified business fields over pushname", () => {
    assert.equal(
      displayNameFromWahaContactInfo({
        id: "49566172321@c.us",
        pushname: "Phone User",
        verifiedBizName: "Sb Union",
      }),
      "Sb Union",
    );
  });
});

describe("wahaChatListDisplayName", () => {
  it("marks phone fallback as needing API resolve for business names", () => {
    const result = wahaChatListDisplayName({
      chatId: "49566172321@c.us",
      overviewName: null,
      overviewChat: {
        id: "49566172321@c.us",
        name: null,
        lastMessage: { body: "Bild" },
      },
    });
    assert.equal(result.needsApiResolve, true);
    assert.ok(needsWahaDisplayNameResolve(result.label));
  });

  it("returns business title without API resolve when overview has verifiedBizName", () => {
    const result = wahaChatListDisplayName({
      chatId: "49566172321@c.us",
      overviewChat: {
        id: "49566172321@c.us",
        name: null,
        lastMessage: {
          body: "Bild",
          _data: { verifiedBizName: "Sb Union" },
        },
      },
    });
    assert.equal(result.label, "Sb Union");
    assert.equal(result.needsApiResolve, false);
  });
});

describe("pickWahaChatReadableTitle", () => {
  it("prefers Gwada company, then WAHA business name", () => {
    assert.equal(
      pickWahaChatReadableTitle({
        matchedGwada: { name: "+49 566172321", company: "Sb Union" },
      }),
      "Sb Union",
    );
  });
});
