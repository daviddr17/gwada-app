"use client";

import { Badge } from "@/components/ui/badge";
import {
  wahaLiveStatusBadgeClassName,
  wahaLiveStatusLabel,
  wahaSessionStatusBadgeClassName,
  wahaSessionStatusLabel,
} from "@/lib/waha/waha-session-status-ui";
import { cn } from "@/lib/utils";

export function WahaSessionStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(wahaSessionStatusBadgeClassName(status), className)}
    >
      {wahaSessionStatusLabel(status)}
    </Badge>
  );
}

export function WahaLiveSessionStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(wahaLiveStatusBadgeClassName(status), className)}
    >
      {wahaLiveStatusLabel(status)}
    </Badge>
  );
}
