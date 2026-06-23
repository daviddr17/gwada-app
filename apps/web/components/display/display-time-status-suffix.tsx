"use client";

import {
  displayTimeStatusClassName,
  displayTimeStatusLabel,
  type DisplayTimeSessionStatus,
} from "@/lib/display/display-time-status";
import { cn } from "@/lib/utils";

export function DisplayTimeStatusSuffix({
  status,
  className,
}: {
  status: DisplayTimeSessionStatus;
  className?: string;
}) {
  return (
    <span className={cn("font-medium", displayTimeStatusClassName(status), className)}>
      {displayTimeStatusLabel(status)}
    </span>
  );
}
