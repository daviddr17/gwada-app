import assert from "node:assert/strict";
import { test } from "node:test";

import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import {
  accountingProfileIdFromPayload,
  firstNamedProfileId,
  preferAccountingFeedTitle,
  resolveAccountingUploaderName,
} from "@/lib/live-activity/live-activity-accounting-uploader";

const PROFILE = "11111111-1111-1111-1111-111111111111";

test("Profil-Id aus dem Event, sonst nichts", () => {
  assert.equal(
    accountingProfileIdFromPayload({ createdByProfileId: PROFILE }),
    PROFILE,
  );
  assert.equal(
    accountingProfileIdFromPayload({ createdByProfileId: null }),
    null,
  );
  assert.equal(accountingProfileIdFromPayload({}), null);
});

test("Name kommt aus dem Profil, sonst aus dem Beleg-Protokoll", () => {
  const names = new Map([[PROFILE, "Lukas Dreyer"]]);
  assert.equal(
    resolveAccountingUploaderName({
      payload: {},
      profileId: PROFILE,
      namesByProfileId: names,
    }),
    "Lukas Dreyer",
  );
  assert.equal(
    resolveAccountingUploaderName({
      payload: { createdByProfileId: PROFILE },
      profileId: null,
      namesByProfileId: new Map(),
      logName: "Lukas Dreyer",
    }),
    "Lukas Dreyer",
  );
  assert.equal(
    resolveAccountingUploaderName({
      payload: {},
      profileId: null,
      namesByProfileId: new Map(),
      logName: "User",
    }),
    null,
  );
});

test("Beleg-Titel nutzt den aufgelösten Namen und lässt Lücken leer", () => {
  const named = liveActivityFromNotificationEvent({
    module: "accounting_voucher",
    payload: {
      voucherNumber: "152305083",
      contactName: "Büroshop24 GmbH",
      amountLabel: "672.65 EUR",
      uploaderName: "Lukas Dreyer",
    },
  });
  assert.equal(named.title, "Lukas Dreyer · Beleg");

  const missing = liveActivityFromNotificationEvent({
    module: "accounting_voucher",
    payload: {
      voucherNumber: "152305083",
      contactName: "Büroshop24 GmbH",
      amountLabel: "672.65 EUR",
      uploaderName: "User",
    },
  });
  assert.equal(missing.title, "Beleg");
});

test("Personenname ersetzt „Beleg“ und wird nicht wieder gelöscht", () => {
  assert.equal(
    preferAccountingFeedTitle("Beleg", "Lukas Dreyer · Beleg"),
    "Lukas Dreyer · Beleg",
  );
  assert.equal(
    preferAccountingFeedTitle("Lukas Dreyer · Beleg", "Beleg"),
    "Lukas Dreyer · Beleg",
  );
  assert.equal(preferAccountingFeedTitle("Beleg", "Beleg"), "Beleg");
});

test("Uploader: created_by vor updated_by, sonst der nächste Name", () => {
  const created = "11111111-1111-1111-1111-111111111111";
  const updated = "22222222-2222-2222-2222-222222222222";
  const names = new Map([
    [created, "Lukas Dreyer"],
    [updated, "David Dreyer"],
  ]);
  assert.equal(firstNamedProfileId([created, updated], names), created);
  assert.equal(
    firstNamedProfileId([created, updated], new Map([[updated, "David Dreyer"]])),
    updated,
  );
  assert.equal(firstNamedProfileId([created], new Map()), null);
});
