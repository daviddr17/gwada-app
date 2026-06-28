import type { ConversationUnreadHint } from "@/lib/contact-messages/conversation-read-state";
import { cn } from "@/lib/utils";

export const INBOX_UNREAD_HINT_GWADA_ONLY_LABEL =
  "Am Kanal gelesen · in Gwada noch offen";

export function inboxUnreadHintLabel(
  hint: ConversationUnreadHint | null | undefined,
): string | null {
  if (hint === "gwada_only") return INBOX_UNREAD_HINT_GWADA_ONLY_LABEL;
  return null;
}

export function inboxUnreadRowBackgroundClassName(
  unread: boolean,
  hint: ConversationUnreadHint | null | undefined,
): string {
  if (!unread) return "";
  if (hint === "gwada_only") return "bg-muted/30";
  return "bg-accent/[0.04]";
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
