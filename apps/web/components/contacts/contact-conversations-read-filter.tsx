"use client";

import type { ConversationReadFilter } from "@/lib/contact-messages/filter-conversations";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ConversationReadFilter; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "unread", label: "Ungelesen" },
  { id: "read", label: "Gelesen" },
  { id: "later", label: "Später" },
];

export function ContactConversationsReadFilter({
  value,
  onChange,
  disabled,
  unreadTotal,
  laterTotal,
}: {
  value: ConversationReadFilter;
  onChange: (value: ConversationReadFilter) => void;
  disabled?: boolean;
  unreadTotal?: number;
  laterTotal?: number;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Nachrichtenfilter"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        const badgeCount =
          opt.id === "unread"
            ? unreadTotal
            : opt.id === "later"
              ? laterTotal
              : undefined;
        const showBadge =
          typeof badgeCount === "number" && badgeCount > 0;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              selected
                ? "border-accent/40 bg-accent/15 text-accent"
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            {opt.label}
            {showBadge ? (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  selected ? "bg-accent text-accent-foreground" : "bg-accent/20 text-accent",
                )}
              >
                {badgeCount! > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
