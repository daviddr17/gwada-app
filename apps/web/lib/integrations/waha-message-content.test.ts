import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractWahaMessageDisplayText,
  resolveWahaInboundMirrorContent,
  unwrapWahaProtobufMessage,
} from "@/lib/contact-messages/waha-message-content";

describe("extractWahaMessageDisplayText", () => {
  it("prefers top-level body", () => {
    assert.equal(
      extractWahaMessageDisplayText({
        body: "Hallo",
        _data: { message: { imageMessage: { caption: "ignored" } } },
      }),
      "Hallo",
    );
  });

  it("reads image caption from protobuf when body empty", () => {
    assert.equal(
      extractWahaMessageDisplayText({
        body: "",
        _data: {
          message: {
            imageMessage: {
              caption: "Mittagstisch ab 12 Uhr",
              mimetype: "image/jpeg",
            },
          },
        },
      }),
      "Mittagstisch ab 12 Uhr",
    );
  });

  it("unwraps viewOnce / ephemeral shells for caption", () => {
    assert.equal(
      extractWahaMessageDisplayText({
        body: "  ",
        _data: {
          message: {
            viewOnceMessage: {
              message: {
                imageMessage: { caption: "Nur heute: -20%" },
              },
            },
          },
        },
      }),
      "Nur heute: -20%",
    );
  });

  it("reads extendedTextMessage (link preview / firm text)", () => {
    assert.equal(
      extractWahaMessageDisplayText({
        body: "",
        _data: {
          message: {
            extendedTextMessage: {
              text: "https://firma.example/angebot",
              jpegThumbnail: "base64",
            },
          },
        },
      }),
      "https://firma.example/angebot",
    );
  });

  it("reads product catalog title + description", () => {
    const text = extractWahaMessageDisplayText({
      body: "",
      _data: {
        message: {
          productMessage: {
            title: "Catering-Paket",
            description: "Für 20 Personen",
            priceAmount1000: 199000,
            currencyCode: "EUR",
          },
        },
      },
    });
    assert.match(text, /Catering-Paket/);
    assert.match(text, /Für 20 Personen/);
  });
});

describe("resolveWahaInboundMirrorContent", () => {
  it("stores caption and image kind for business image+text", () => {
    const result = resolveWahaInboundMirrorContent({
      body: "",
      hasMedia: false,
      _data: {
        message: {
          imageMessage: {
            caption: "Wochenkarte",
            mimetype: "image/jpeg",
            url: "https://example/media",
          },
        },
      },
    });
    assert.equal(result.hasContent, true);
    assert.equal(result.body, "Wochenkarte");
    assert.equal(result.mediaKind, "image");
  });

  it("falls back to media label when no caption", () => {
    const result = resolveWahaInboundMirrorContent({
      body: "",
      hasMedia: true,
      type: "image",
      media: { mimetype: "image/jpeg", url: "https://x" },
    });
    assert.equal(result.hasContent, true);
    assert.equal(result.body, "Bild");
    assert.equal(result.mediaKind, "image");
  });

  it("returns empty when nothing useful", () => {
    const result = resolveWahaInboundMirrorContent({ body: "   " });
    assert.equal(result.hasContent, false);
    assert.equal(result.body, "");
  });
});

describe("unwrapWahaProtobufMessage", () => {
  it("unwraps nested documentWithCaptionMessage", () => {
    const msg = unwrapWahaProtobufMessage({
      message: {
        documentWithCaptionMessage: {
          message: {
            documentMessage: { caption: "PDF Infos", fileName: "x.pdf" },
          },
        },
      },
    });
    assert.ok(msg?.documentMessage);
  });
});
