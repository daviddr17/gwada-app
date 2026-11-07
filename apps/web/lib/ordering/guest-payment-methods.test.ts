import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enabledGuestPaymentMethodIds,
  guestPaymentMethodNeedsTerminal,
  guestPaymentMethodsForChannel,
  isGuestPaymentMethodEnabled,
  isGuestPaymentMethodId,
  normalizeGuestPaymentMethods,
} from "./guest-payment-methods.ts";

describe("guest-payment-methods", () => {
  it("validates method ids", () => {
    assert.equal(isGuestPaymentMethodId("cash"), true);
    assert.equal(isGuestPaymentMethodId("card_terminal"), true);
    assert.equal(isGuestPaymentMethodId("hosted"), false);
  });

  it("enforces channel-specific configs", () => {
    const online = {
      cardTerminal: false,
      cash: true,
      paypal: true,
      softpos: false,
    };
    const kiosk = {
      cardTerminal: true,
      cash: false,
      paypal: false,
      softpos: true,
    };
    assert.deepEqual(
      guestPaymentMethodsForChannel("online", online, kiosk),
      online,
    );
    assert.deepEqual(
      guestPaymentMethodsForChannel("kiosk", online, kiosk),
      kiosk,
    );
    assert.deepEqual(
      guestPaymentMethodsForChannel("table", online, kiosk),
      kiosk,
    );
    assert.equal(isGuestPaymentMethodEnabled(online, "cash"), true);
    assert.equal(isGuestPaymentMethodEnabled(online, "card_terminal"), false);
    assert.deepEqual(enabledGuestPaymentMethodIds(online), ["cash", "paypal"]);
  });

  it("marks terminal-backed methods", () => {
    assert.equal(guestPaymentMethodNeedsTerminal("card_terminal"), true);
    assert.equal(guestPaymentMethodNeedsTerminal("softpos"), true);
    assert.equal(guestPaymentMethodNeedsTerminal("cash"), false);
    assert.equal(guestPaymentMethodNeedsTerminal("paypal"), false);
  });

  it("normalizes partial patches against fallback", () => {
    assert.deepEqual(
      normalizeGuestPaymentMethods(
        { cash: false },
        {
          cardTerminal: true,
          cash: true,
          paypal: false,
          softpos: false,
        },
      ),
      {
        cardTerminal: true,
        cash: false,
        paypal: false,
        softpos: false,
      },
    );
  });
});
