import assert from "node:assert/strict";
import { test } from "node:test";

import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";

function money(description: string | null | undefined): string {
  return (description ?? "").replace(/[\u00a0\u202f]/g, " ");
}

test("Beleg im Heute-Feed ist Klartext ohne IDs", () => {
  const item = liveActivityFromNotificationEvent({
    eventId: "evt-1",
    module: "accounting_voucher",
    payload: {
      documentId: "eb225238-182b-497a-9677-9796a2ac75e1",
      voucherNumber: null,
      contactName: "Gasthof zur Post",
      amountLabel: "381.87 EUR",
      createdByProfileId: "11111111-1111-1111-1111-111111111111",
    },
  });

  assert.equal(item.title, "Beleg");
  assert.equal(money(item.description), "381,87 € · Gasthof zur Post");
  assert.equal(item.description?.includes("documentId"), false);
  assert.equal(item.description?.includes("{"), false);
});

test("Rechnung und Angebot nennen Nummer, Betrag und Empfänger", () => {
  const invoice = liveActivityFromNotificationEvent({
    module: "accounting_invoice",
    payload: {
      documentId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      title: "Neue Rechnung",
      voucherNumber: "RE-12",
      recipientLabel: "Bäckerei Sonnenschein",
      amountLabel: "12.50 EUR",
    },
  });
  assert.equal(invoice.title, "Rechnung");
  assert.equal(
    money(invoice.description),
    "Nr. RE-12 · 12,50 € · Bäckerei Sonnenschein",
  );

  const quote = liveActivityFromNotificationEvent({
    module: "accounting_quotation",
    payload: {
      title: "Sommerfest",
      voucherNumber: "AN-3",
      recipientLabel: "Empfänger",
      amountLabel: "1000 EUR",
    },
  });
  assert.equal(quote.title, "Angebot");
  assert.equal(money(quote.description), "Sommerfest · Nr. AN-3 · 1.000,00 €");
});
