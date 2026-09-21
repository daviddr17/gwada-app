import assert from "node:assert/strict";
import { test } from "node:test";

import { formatNotificationPayloadSummary } from "@/lib/superadmin/superadmin-notification-log";

test("Beleg im Push-Verlauf ist Klartext, kein JSON", () => {
  const text = formatNotificationPayloadSummary("accounting_voucher", {
    documentId: "doc-1",
    amountLabel: "381.87 EUR",
    contactName: "Gasthof zur Post",
    title: "Beleg",
  });
  assert.equal(text.includes("{"), false);
  assert.equal(text.includes("documentId"), false);
  assert.match(text, /381,87/);
  assert.match(text, /Gasthof zur Post/);
});

test("Aufgabe und Einladung sind Klartext", () => {
  assert.equal(
    formatNotificationPayloadSummary("staff_todo_deferred", {
      todoTitle: "Kühlschrank",
      details: { reason: "Ware fehlt" },
    }),
    "Kühlschrank · Ware fehlt",
  );
  assert.equal(
    formatNotificationPayloadSummary("staff_invite_accepted", {
      staffName: "Mara Klein",
      positionName: "Service",
    }),
    "Mara Klein · Service",
  );
});

test("Unbekanntes Modul wird nicht als JSON gezeigt", () => {
  const text = formatNotificationPayloadSummary("not_a_module", {
    documentId: "x",
    nested: { a: 1 },
  });
  assert.equal(text, "—");
});
