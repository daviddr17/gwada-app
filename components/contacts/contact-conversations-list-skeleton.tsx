"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ConversationRowSkeleton() {
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-[38%] max-w-[10rem] rounded-md" />
          <Skeleton className="h-2.5 w-12 shrink-0 rounded-md" />
        </div>
        <Skeleton className="h-3.5 w-[72%] max-w-md rounded-md" />
      </div>
    </li>
  );
}

/** Chat-Liste (WhatsApp-Stil) während WAHA/IMAP/DB lädt. */
export function ContactConversationsListSkeleton({
  rows = 7,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <ul
      className={cn("divide-y divide-border/50", className)}
      aria-busy
      aria-label="Chats werden geladen"
    >
      {Array.from({ length: rows }, (_, i) => (
        <ConversationRowSkeleton key={i} />
      ))}
    </ul>
  );
}
