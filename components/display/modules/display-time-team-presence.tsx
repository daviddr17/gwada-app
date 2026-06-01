"use client";

import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import type { DisplayTeamPresenceMember } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

function presenceLabel(member: DisplayTeamPresenceMember): string {
  if (member.status === "on_break" && member.break_started_at) {
    return `Pause seit ${timeFmt.format(new Date(member.break_started_at))}`;
  }
  return `seit ${timeFmt.format(new Date(member.clocked_in_at))}`;
}

export function DisplayTimeTeamPresence({
  members,
  className,
}: {
  members: DisplayTeamPresenceMember[];
  className?: string;
}) {
  const working = members.filter((m) => m.status === "working");
  const onBreak = members.filter((m) => m.status === "on_break");

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border/50 bg-card p-4 shadow-card",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">Team gerade</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {working.length} in Schicht
        {onBreak.length > 0 ? ` · ${onBreak.length} in Pause` : ""}
      </p>

      {members.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Niemand eingestempelt.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {members.map((member) => {
            const name =
              `${member.given_name} ${member.family_name}`.trim();
            const initials = displayPersonInitials(
              member.given_name,
              member.family_name,
            );
            return (
              <li
                key={member.staff_id}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5"
              >
                <StaffWorkEntryTypeStripe
                  type={member.status === "on_break" ? "break" : "work"}
                  className="h-10 shrink-0 self-stretch"
                />
                <DisplayRoundAvatar
                  src={member.avatar_url}
                  initials={initials}
                  alt={name}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-snug">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.position_name ? `${member.position_name} · ` : ""}
                    {presenceLabel(member)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
