"use client";

import { Inbox, UserRound } from "lucide-react";
import {
  INBOX_MAILBOX_LABELS,
  INBOX_MAILBOX_PERSONAL,
  INBOX_MAILBOX_SHARED,
  type InboxMailbox,
} from "@/lib/contact-messages/inbox-mailbox";
import { cn } from "@/lib/utils";

const MAILBOX_ORDER: readonly InboxMailbox[] = [
  INBOX_MAILBOX_SHARED,
  INBOX_MAILBOX_PERSONAL,
];

function MailboxIcon({
  mailbox,
  className,
}: {
  mailbox: InboxMailbox;
  className?: string;
}) {
  if (mailbox === INBOX_MAILBOX_PERSONAL) {
    return <UserRound className={cn("size-4", className)} aria-hidden />;
  }
  return <Inbox className={cn("size-4", className)} aria-hidden />;
}

export function InboxMailboxChips({
  mailbox,
  onMailboxChange,
  disabled,
}: {
  mailbox: InboxMailbox;
  onMailboxChange: (mailbox: InboxMailbox) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Postfach"
    >
      {MAILBOX_ORDER.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          disabled={disabled}
          onClick={() => onMailboxChange(m)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            mailbox === m
              ? "border-accent/50 bg-accent/15 text-foreground"
              : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-selected={mailbox === m}
        >
          <MailboxIcon mailbox={m} />
          {INBOX_MAILBOX_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
