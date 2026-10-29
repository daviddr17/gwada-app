/** Nachrichten: Multipostfach (geteilt) vs. persönliches Postfach (Teamchat). */

export const INBOX_MAILBOX_SHARED = "shared" as const;
export const INBOX_MAILBOX_PERSONAL = "personal" as const;

export const INBOX_MAILBOXES = [
  INBOX_MAILBOX_SHARED,
  INBOX_MAILBOX_PERSONAL,
] as const;

export type InboxMailbox = (typeof INBOX_MAILBOXES)[number];

export const INBOX_MAILBOX_LABELS: Record<InboxMailbox, string> = {
  shared: "Multipostfach",
  personal: "Persönlich",
};

/** Label on personal teamchat rows / thread chrome. */
export const STAFF_EMPLOYEE_MESSAGE_LABEL = "Mitarbeiternachricht";

export function isInboxMailbox(value: string): value is InboxMailbox {
  return (INBOX_MAILBOXES as readonly string[]).includes(value);
}

export function parseInboxMailbox(
  mailboxParam: string | null | undefined,
): InboxMailbox {
  if (mailboxParam && isInboxMailbox(mailboxParam)) return mailboxParam;
  return INBOX_MAILBOX_SHARED;
}

export function inboxPersonalMailboxHref(opts?: {
  conversationId?: string | null;
}): string {
  const params = new URLSearchParams({ mailbox: INBOX_MAILBOX_PERSONAL });
  const c = opts?.conversationId?.trim();
  if (c) params.set("c", c);
  return `/dashboard/contacts/messages?${params.toString()}`;
}

export function inboxSharedMailboxHref(opts?: {
  platform?: string | null;
}): string {
  const params = new URLSearchParams({ mailbox: INBOX_MAILBOX_SHARED });
  const platform = opts?.platform?.trim();
  if (platform) params.set("platform", platform);
  else params.set("platform", "all");
  return `/dashboard/contacts/messages?${params.toString()}`;
}
