import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeMetaThreadMessages } from "./merge-meta-thread-messages.ts";
import type { ContactMessageRow } from "../supabase/contact-messages-db.ts";

function row(
  partial: Pick<ContactMessageRow, "id" | "created_at" | "body"> &
    Partial<ContactMessageRow>,
): ContactMessageRow {
  return {
    restaurant_id: "r",
    contact_id: "meta:facebook:1",
    platform: "facebook",
    direction: "inbound",
    reservation_id: null,
    sent_by: null,
    delivery_status: "delivered",
    ...partial,
  };
}

test("merge keeps graph text and a stored-only outbound", () => {
  const merged = mergeMetaThreadMessages(
    [
      row({
        id: "meta:facebook:m1",
        meta_message_id: "m1",
        external_source_id: "m1",
        created_at: "2026-10-01T10:00:00.000Z",
        body: "live",
      }),
    ],
    [
      row({
        id: "db-1",
        external_source_id: "meta:facebook:m1",
        created_at: "2026-10-01T10:00:00.000Z",
        body: "stale",
      }),
      row({
        id: "db-2",
        external_source_id: "meta:facebook:m2",
        created_at: "2026-10-01T11:00:00.000Z",
        body: "nur db",
        direction: "outbound",
      }),
    ],
  );

  assert.deepEqual(
    merged.map((m) => m.body),
    ["live", "nur db"],
  );
});
