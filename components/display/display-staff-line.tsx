"use client";

import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import type { DisplaySessionStaff } from "@/lib/display/display-types";
import { cn } from "@/lib/utils";

export function DisplayStaffLine({
  staff,
  suffix,
  className,
}: {
  staff: Pick<DisplaySessionStaff, "given_name" | "family_name" | "avatar_url" | "position_name">;
  suffix?: React.ReactNode;
  className?: string;
}) {
  const name = `${staff.given_name} ${staff.family_name}`.trim();
  const initials = displayPersonInitials(staff.given_name, staff.family_name);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <DisplayRoundAvatar
        src={staff.avatar_url}
        initials={initials}
        alt={name}
        size="sm"
        className="shrink-0"
      />
      <span className="truncate">
        {name}
        {staff.position_name ? ` · ${staff.position_name}` : ""}
        {suffix ? (
          <>
            {" · "}
            {suffix}
          </>
        ) : null}
      </span>
    </div>
  );
}
