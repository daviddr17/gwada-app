import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { humanizeReservationSaveError } from "./reservation-save-error-message.ts";

describe("humanizeReservationSaveError", () => {
  it("maps Bad Gateway to a retry hint", () => {
    assert.match(
      humanizeReservationSaveError("Bad Gateway"),
      /Verbindungsstörung/,
    );
    assert.match(humanizeReservationSaveError("502"), /noch einmal tippen/);
  });

  it("keeps domain unique-constraint messages", () => {
    assert.match(
      humanizeReservationSaveError(
        'duplicate key value violates unique constraint "reservations_quotation_id_unique"',
      ),
      /Angebot/,
    );
  });

  it("passes through unknown messages", () => {
    assert.equal(
      humanizeReservationSaveError("Statuskonflikt"),
      "Statuskonflikt",
    );
  });
});
