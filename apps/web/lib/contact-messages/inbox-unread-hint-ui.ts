import type { ConversationUnreadHint } from "@/lib/contact-messages/conversation-read-state";
import { cn } from "@/lib/utils";

export const INBOX_UNREAD_HINT_GWADA_ONLY_LABEL =
  "Bereits gelesen · in Gwada noch offen";

export function inboxUnreadHintLabel(
  hint: ConversationUnreadHint | null | undefined,
): string | null {
  if (hint === "gwada_only") return INBOX_UNREAD_HINT_GWADA_ONLY_LABEL;
  return null;
}

/** Sichtbarer Status in der Inbox-Zeile — beide Ungelesen-Arten bekommen ein Label. */
export function inboxUnreadStatusChipLabel(
  unread: boolean,
  hint: ConversationUnreadHint | null | undefined,
): string | null {
  if (!unread) return null;
  return hint === "gwada_only" ? "In Gwada offen" : "Neu";
}

export function inboxUnreadStatusChipClassName(
  hint: ConversationUnreadHint | null | undefined,
): string {
  return cn(
    "inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[10px] font-medium",
    hint === "gwada_only"
      ? "border-border/70 bg-muted/70 text-muted-foreground"
      : "border-accent/40 bg-accent/15 text-accent",
  );
}

export function inboxUnreadRowStripeClassName(
  unread: boolean,
  hint: ConversationUnreadHint | null | undefined,
): string {
  if (!unread) return "";
  return cn(
    "absolute inset-y-0 left-0 w-1",
    hint === "gwada_only" ? "bg-muted-foreground/50" : "bg-accent",
  );
}

export function inboxUnreadRowBackgroundClassName(
  unread: boolean,
  hint: ConversationUnreadHint | null | undefined,
): string {
  if (!unread) return "";
  if (hint === "gwada_only") return "bg-muted/25";
  return "bg-accent/10";
}

export function inboxUnreadAvatarClassName(
  unread: boolean,
  hint: ConversationUnreadHint | null | undefined,
): string {
  if (!unread) return "bg-accent/15 text-accent";
  if (hint === "gwada_only") return "bg-muted text-muted-foreground";
  return "bg-accent/25 text-accent";
}

export function inboxUnreadDotClassName(
  hint: ConversationUnreadHint | null | undefined,
): string {
  if (hint === "gwada_only") {
    return "bg-muted-foreground/70 ring-2 ring-card";
  }
  return "bg-accent ring-2 ring-card";
}

export function inboxUnreadCountBadgeClassName(
  hint: ConversationUnreadHint | null | undefined,
): string {
  return cn(
    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
    hint === "gwada_only"
      ? "border border-border/60 bg-muted/50 text-muted-foreground"
      : "bg-accent text-accent-foreground",
  );
}

export function inboxUnreadNameClassName(
  unread: boolean,
  hint: ConversationUnreadHint | null | undefined,
): string {
  if (unread && hint !== "gwada_only") return "font-semibold text-foreground";
  return "font-medium";
}
