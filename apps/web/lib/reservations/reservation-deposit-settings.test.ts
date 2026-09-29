import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  depositIsEnabled,
  depositNumbersForSave,
  formatDepositAmountInput,
  parseDepositAmountCents,
} from "./reservation-deposit-settings.ts";

describe("reservation deposit settings", () => {
  it("stays off when the settings row is missing", () => {
    assert.equal(depositIsEnabled(null), false);
    assert.equal(depositIsEnabled(undefined), false);
    assert.equal(depositIsEnabled({}), false);
    assert.equal(depositIsEnabled({ deposit_enabled: false }), false);
    assert.equal(depositIsEnabled({ deposit_enabled: true }), true);
  });

  it("reads euro amounts with a comma", () => {
    assert.equal(parseDepositAmountCents("12,50"), 1250);
    assert.equal(parseDepositAmountCents("1.234,50"), 123450);
    assert.equal(formatDepositAmountInput(1250), "12,50");
  });

  it("requires a positive amount only while the deposit is on", () => {
    const off = depositNumbersForSave({
      enabled: false,
      minPartyRaw: "8",
      amountRaw: "",
      dueHoursRaw: "48",
    });
    assert.deepEqual(off, {
      ok: true,
      minParty: 8,
      amountCents: 0,
      dueHours: 48,
    });

    const on = depositNumbersForSave({
      enabled: true,
      minPartyRaw: "8",
      amountRaw: "0",
      dueHoursRaw: "48",
    });
    assert.equal(on.ok, false);
  });

  it("keeps party size, cents, and hours when the deposit is on", () => {
    const saved = depositNumbersForSave({
      enabled: true,
      minPartyRaw: "6",
      amountRaw: "15,00",
      dueHoursRaw: "24",
    });
    assert.deepEqual(saved, {
      ok: true,
      minParty: 6,
      amountCents: 1500,
      dueHours: 24,
    });
  });
});
