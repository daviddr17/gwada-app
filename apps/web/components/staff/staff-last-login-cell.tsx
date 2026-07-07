"use client";

import { Monitor, Smartphone } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatStaffLastLogin,
  resolveStaffLastLogin,
  STAFF_LAST_LOGIN_SOURCE_LABELS,
  type StaffLastLoginSource,
} from "@/lib/staff/staff-last-login";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

const SOURCE_ICONS: Record<StaffLastLoginSource, typeof Smartphone> = {
  app: Smartphone,
  display: Monitor,
};

type StaffLastLoginCellProps = {
  row: Pick<RestaurantStaffRow, "linked_profile">;
  lastDisplayActivityAt?: string | null;
  className?: string;
};

export function StaffLastLoginCell({
  row,
  lastDisplayActivityAt,
  className,
}: StaffLastLoginCellProps) {
  const info = resolveStaffLastLogin(row, lastDisplayActivityAt);
  if (!info) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const Icon = SOURCE_ICONS[info.source];
  const label = STAFF_LAST_LOGIN_SOURCE_LABELS[info.source];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 tabular-nums text-muted-foreground",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="inline-flex shrink-0 items-center justify-center text-muted-foreground/80"
              aria-label={label}
            />
          }
        >
          <Icon className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
      {formatStaffLastLogin(info.iso)}
    </span>
  );
}
