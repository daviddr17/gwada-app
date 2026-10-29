import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INBOX_MAILBOX_PERSONAL,
  INBOX_MAILBOX_SHARED,
  inboxPersonalMailboxHref,
  inboxSharedMailboxHref,
  parseInboxMailbox,
} from "./inbox-mailbox.ts";

describe("inbox-mailbox", () => {
  it("defaults missing mailbox to shared multipostfach", () => {
    assert.equal(parseInboxMailbox(null), INBOX_MAILBOX_SHARED);
    assert.equal(parseInboxMailbox(undefined), INBOX_MAILBOX_SHARED);
    assert.equal(parseInboxMailbox("nope"), INBOX_MAILBOX_SHARED);
  });

  it("parses personal mailbox", () => {
    assert.equal(parseInboxMailbox("personal"), INBOX_MAILBOX_PERSONAL);
  });

  it("builds personal href with optional conversation", () => {
    assert.equal(
      inboxPersonalMailboxHref(),
      "/dashboard/contacts/messages?mailbox=personal",
    );
    assert.equal(
      inboxPersonalMailboxHref({ conversationId: "abc" }),
      "/dashboard/contacts/messages?mailbox=personal&c=abc",
    );
  });

  it("builds shared href without staff conversation id", () => {
    assert.equal(
      inboxSharedMailboxHref(),
      "/dashboard/contacts/messages?mailbox=shared&platform=all",
    );
    assert.ok(!inboxSharedMailboxHref().includes("c="));
  });
});
