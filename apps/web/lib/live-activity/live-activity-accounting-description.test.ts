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

test("angelegte Reservierung nennt die Angaben ohne Leer-Diff", () => {
  const item = liveActivityFromNotificationEvent({
    module: "reservations_activity",
    payload: {
      action: "created",
      staffName: "David Dreyer",
      guestLabel: "#2625 · Cristian Vidal",
      summary:
        "Gast: „—“ → „Cristian Vidal“ · Personen: „—“ → „3“ · Termin: „—“ → „Sa. 26.09.2026, 19:00“ · Status: „—“ → „Bestätigt“ · Tisch: „—“ → „Kein Tisch“",
      changes: [
        { field: "guest", label: "Gast", from: null, to: "Cristian Vidal" },
        { field: "party_size", label: "Personen", from: null, to: "3" },
        {
          field: "starts_at",
          label: "Termin",
          from: null,
          to: "Sa. 26.09.2026, 19:00",
        },
        { field: "status", label: "Status", from: null, to: "Bestätigt" },
        { field: "table", label: "Tisch", from: null, to: "Kein Tisch" },
      ],
    },
  });

  assert.equal(item.title, "David Dreyer · Reservierung angelegt");
  assert.equal(
    item.description,
    "#2625 · Cristian Vidal · 3 Personen · Sa. 26.09.2026, 19:00 · Bestätigt",
  );
});

test("übrige Feed-Zeilen sind Klartext ohne IDs", () => {
  const cases: Array<{
    module: string;
    payload: Record<string, unknown>;
    title: string;
    description: string;
  }> = [
    {
      module: "staff_display_clock_in",
      payload: { staffName: "Anna Berger" },
      title: "Anna Berger · angemeldet",
      description: "Hat sich am Display angemeldet",
    },
    {
      module: "staff_shift_start",
      payload: {
        staffName: "Anna Berger",
        label: "Service",
        startsAt: "2026-09-12T16:00:00.000Z",
        endsAt: "2026-09-12T21:00:00.000Z",
      },
      title: "Anna Berger · Schichtstart",
      description: "Service · 18:00–23:00",
    },
    {
      module: "reservations_pending",
      payload: {
        guestLabel: "Max Meier",
        partySize: 4,
        startsAt: "2026-09-12T17:00:00.000Z",
        reservationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      },
      title: "Neue Reservierung",
      description: "Max Meier · 4 Personen · 12.09. · 19:00",
    },
    {
      module: "messages",
      payload: {
        contactName: "Lisa",
        senderEmail: "lisa@example.com",
        preview: "Tisch für morgen?",
        platform: "whatsapp",
      },
      title: "Nachricht · Lisa",
      description: "WhatsApp — „Tisch für morgen?“",
    },
    {
      module: "reviews",
      payload: {
        authorName: "Kai",
        rating: 5,
        platform: "google",
        commentPreview: "Sehr lecker",
        reviewId: "google:abc",
      },
      title: "Bewertung",
      description: "Kai · 5 Sterne · Google — „Sehr lecker“",
    },
    {
      module: "inventory_low_stock",
      payload: {
        ingredientId: "ing-1",
        ingredientName: "Tomaten",
        currentStock: 0.5,
        unit: "kg",
      },
      title: "Bestand niedrig",
      description: "Tomaten · noch 0,5 kg",
    },
    {
      module: "inventory_po_delivery_due",
      payload: { supplierName: "Metro", kind: "overdue", orderId: "po-1" },
      title: "Lieferung fällig",
      description: "Metro · überfällig",
    },
    {
      module: "staff_todo_completed",
      payload: {
        logEntryId: "11111111-1111-1111-1111-111111111111",
        todoId: "22222222-2222-2222-2222-222222222222",
        todoTitle: "Kühlschrank prüfen",
        actorUserId: "33333333-3333-3333-3333-333333333333",
      },
      title: "ToDo erledigt",
      description: "Kühlschrank prüfen",
    },
    {
      module: "staff_todo_deferred",
      payload: {
        todoTitle: "Inventur",
        details: { reason: "Lieferung kommt erst morgen" },
      },
      title: "ToDo verschoben",
      description: "Inventur · Lieferung kommt erst morgen",
    },
    {
      module: "staff_document_assigned",
      payload: {
        documentId: "eb225238-182b-497a-9677-9796a2ac75e1",
        documentTitle: "Arbeitszeugnis",
      },
      title: "Dokument",
      description: "Arbeitszeugnis",
    },
    {
      module: "staff_contract_signed",
      payload: {
        contractId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        contractTitle: "Vertrag 2026",
        pendingEmployeeSignature: true,
      },
      title: "Arbeitsvertrag",
      description: "Vertrag 2026 · bitte unterschreiben",
    },
    {
      module: "staff_display_time_request",
      payload: {
        requestId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        entryType: "work",
        requestedStartsAt: "2026-09-12T16:00:00.000Z",
        requestedEndsAt: "2026-09-12T18:00:00.000Z",
      },
      title: "Zeit nachtragen",
      description: "Arbeitszeit · 18:00–20:00",
    },
    {
      module: "staff_invite_accepted",
      payload: {
        inviteId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        staffName: "Noah Klein",
        positionName: "Service",
      },
      title: "Einladung angenommen",
      description: "Noah Klein · Service",
    },
    {
      module: "staff_permissions_granted",
      payload: {
        unlockId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
        permissionKeys: ["menu.read", "inventory.read"],
        permissionLabels: ["Speisekarte ansehen", "Bestand ansehen"],
        positionName: "Service",
      },
      title: "Neue Rechte",
      description: "Service · Speisekarte ansehen, Bestand ansehen",
    },
    {
      module: "personal_reminder",
      payload: { title: "Wein bestellen", body: "Beim Großhändler anrufen" },
      title: "Persönliche Erinnerung",
      description: "Wein bestellen · Beim Großhändler anrufen",
    },
    {
      module: "staff_messages",
      payload: { peerName: "Mara", preview: "Kannst du die Spätschicht übernehmen?" },
      title: "Team-Nachricht",
      description: "Mara: „Kannst du die Spätschicht übernehmen?“",
    },
  ];

  for (const sample of cases) {
    const item = liveActivityFromNotificationEvent({
      module: sample.module,
      payload: sample.payload,
    });
    assert.equal(item.title, sample.title, sample.module);
    assert.equal(money(item.description), sample.description, sample.module);
    assert.equal(item.description?.includes("{"), false, sample.module);
    assert.equal(item.description?.includes("documentId"), false, sample.module);
  }
});
