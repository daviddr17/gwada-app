import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { describe, it } from "node:test";

import {
  metaWebhookInboundEnabled,
  metaWebhookVerifyChallenge,
  verifyMetaWebhookSignature,
} from "./meta-webhook-verify.ts";

describe("metaWebhookVerifyChallenge", () => {
  it("echoes challenge when mode/token match", () => {
    const out = metaWebhookVerifyChallenge({
      mode: "subscribe",
      token: "gwada-verify",
      challenge: "12345",
      expectedToken: "gwada-verify",
    });
    assert.equal(out, "12345");
  });

  it("rejects wrong token or mode", () => {
    assert.equal(
      metaWebhookVerifyChallenge({
        mode: "subscribe",
        token: "nope",
        challenge: "12345",
        expectedToken: "gwada-verify",
      }),
      null,
    );
    assert.equal(
      metaWebhookVerifyChallenge({
        mode: "unsubscribe",
        token: "gwada-verify",
        challenge: "12345",
        expectedToken: "gwada-verify",
      }),
      null,
    );
  });

  it("rejects when expected token missing", () => {
    assert.equal(
      metaWebhookVerifyChallenge({
        mode: "subscribe",
        token: "any",
        challenge: "1",
        expectedToken: "",
      }),
      null,
    );
  });
});

describe("verifyMetaWebhookSignature", () => {
  it("skips check when no app secret", () => {
    assert.equal(verifyMetaWebhookSignature("{}", null, null), true);
  });

  it("accepts valid sha256 HMAC", () => {
    const secret = "test-app-secret";
    const body = '{"object":"page"}';
    const digest = createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(
      verifyMetaWebhookSignature(body, `sha256=${digest}`, secret),
      true,
    );
  });

  it("rejects missing or wrong signature when secret set", () => {
    assert.equal(verifyMetaWebhookSignature("{}", null, "secret"), false);
    assert.equal(
      verifyMetaWebhookSignature("{}", "sha256=deadbeef", "secret"),
      false,
    );
  });
});

describe("metaWebhookInboundEnabled", () => {
  it("is only true for exact string true", () => {
    const prev = process.env.META_WEBHOOK_INBOUND_ENABLED;
    try {
      delete process.env.META_WEBHOOK_INBOUND_ENABLED;
      assert.equal(metaWebhookInboundEnabled(), false);
      process.env.META_WEBHOOK_INBOUND_ENABLED = "false";
      assert.equal(metaWebhookInboundEnabled(), false);
      process.env.META_WEBHOOK_INBOUND_ENABLED = "true";
      assert.equal(metaWebhookInboundEnabled(), true);
    } finally {
      if (prev === undefined) delete process.env.META_WEBHOOK_INBOUND_ENABLED;
      else process.env.META_WEBHOOK_INBOUND_ENABLED = prev;
    }
  });
});
