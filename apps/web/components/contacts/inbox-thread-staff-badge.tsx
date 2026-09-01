"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type InboxThreadStaffBadgeProps = {
  staffName: string;
  className?: string;
  /** Kompakter Text in der Konversationsliste. */
  compact?: boolean;
};

export function InboxThreadStaffBadge({
  staffName,
  className,
  compact = false,
}: InboxThreadStaffBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-0.5 border-accent/40 bg-accent/10 px-1.5 text-[10px] font-normal text-foreground",
        className,
      )}
    >
      <Users className="size-3 shrink-0" aria-hidden />
      <span className="max-w-[9rem] truncate">
        {compact ? staffName : `Mitarbeiter · ${staffName}`}
      </span>
    </Badge>
  );
}
