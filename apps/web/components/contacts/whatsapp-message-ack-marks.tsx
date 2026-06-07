"use client";

import { Check, CheckCheck, Clock } from "lucide-react";
import {
  WAHA_ACK_LABELS,
  wahaAckLevel,
  type WahaMessageAckLevel,
} from "@/lib/waha/waha-message-ack";
import { cn } from "@/lib/utils";

export function WhatsAppMessageAckMarks({
  ack,
  outbound,
  className,
}: {
  ack?: number | null;
  outbound: boolean;
  className?: string;
}) {
  if (!outbound) return null;

  const level = wahaAckLevel(ack);
  const label = WAHA_ACK_LABELS[level];

  return (
    <span
      className={cn("inline-flex items-center", className)}
      title={label}
      aria-label={label}
    >
      <AckIcon level={level} />
    </span>
  );
}

function AckIcon({ level }: { level: WahaMessageAckLevel }) {
  switch (level) {
    case "pending":
      return (
        <Clock
          className="size-3 opacity-70"
          aria-hidden
        />
      );
    case "sent":
      return (
        <Check
          className="size-3.5 stroke-[2.5]"
          aria-hidden
        />
      );
    case "delivered":
      return (
        <CheckCheck
          className="size-3.5 stroke-[2.5] text-muted-foreground"
          aria-hidden
        />
      );
    case "read":
    case "played":
      return (
        <CheckCheck
          className="size-3.5 stroke-[2.5] text-sky-500 dark:text-sky-400"
          aria-hidden
        />
      );
  }
}
