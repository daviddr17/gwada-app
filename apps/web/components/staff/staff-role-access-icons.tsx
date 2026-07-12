"use client";

import { LayoutDashboard, Monitor } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  resolveStaffAccessChannels,
  type StaffAccessChannelFields,
} from "@/lib/staff/staff-app-access";
import { cn } from "@/lib/utils";

type StaffRoleAccessIconsProps = StaffAccessChannelFields & {
  className?: string;
};

export function StaffRoleAccessIcons({
  className,
  ...row
}: StaffRoleAccessIconsProps) {
  const { dashboard, display } = resolveStaffAccessChannels(row);

  if (!dashboard && !display) {
    return null;
  }

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
      aria-label={
        dashboard && display
          ? "Dashboard- und Display-Zugang"
          : dashboard
            ? "Dashboard-Zugang"
            : "Display-Zugang"
      }
    >
      {dashboard ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex items-center justify-center text-green-700/80 dark:text-green-300/90" />
            }
          >
            <LayoutDashboard className="size-3.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="top">Dashboard-Zugang</TooltipContent>
        </Tooltip>
      ) : null}
      {display ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex items-center justify-center text-muted-foreground/80" />
            }
          >
            <Monitor className="size-3.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="top">Display-Zugang (PIN)</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
