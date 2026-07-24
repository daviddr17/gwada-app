"use client";

import { useMemo } from "react";
import { DisplayRoundAvatar } from "@/components/display/display-round-avatar";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { Badge } from "@/components/ui/badge";
import { displayPersonInitials } from "@/lib/display/display-avatar-utils";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { STAFF_PRESENCE_STATUS_LABELS } from "@/lib/staff/staff-presence-labels";
import type { DisplayTeamPresenceMember } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

function presenceLabel(
  member: DisplayTeamPresenceMember,
  timeFmt: Intl.DateTimeFormat,
): string {
  const since = `seit ${timeFmt.format(new Date(member.clocked_in_at))}`;
  if (member.status === "on_break" && member.break_started_at) {
    return `${since} · Pause seit ${timeFmt.format(new Date(member.break_started_at))}`;
  }
  return since;
}

function compareTeamPresenceByStart(
  a: DisplayTeamPresenceMember,
  b: DisplayTeamPresenceMember,
): number {
  const byStart = a.clocked_in_at.localeCompare(b.clocked_in_at);
  if (byStart !== 0) return byStart;
  const nameA = `${a.family_name} ${a.given_name}`.trim();
  const nameB = `${b.family_name} ${b.given_name}`.trim();
  return nameA.localeCompare(nameB, "de");
}

export function DisplayTimeTeamPresence({
  members,
  className,
}: {
  members: DisplayTeamPresenceMember[];
  className?: string;
}) {
  const timeZone = useDisplayRestaurantTimezone();
  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );
  const sortedMembers = useMemo(
    () => [...members].sort(compareTeamPresenceByStart),
    [members],
  );
  const working = sortedMembers.filter((m) => m.status === "working");
  const onBreak = sortedMembers.filter((m) => m.status === "on_break");

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

      {sortedMembers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Niemand eingestempelt.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sortedMembers.map((member) => {
            const name =
              `${member.given_name} ${member.family_name}`.trim();
            const initials = displayPersonInitials(
              member.given_name,
              member.family_name,
            );
            const isOnBreak = member.status === "on_break";
            return (
              <li
                key={member.staff_id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                  isOnBreak
                    ? "border-amber-400/35 bg-amber-400/10"
                    : "border-border/40 bg-muted/15",
                )}
              >
                <StaffWorkEntryTypeStripe
                  type={isOnBreak ? "break" : "work"}
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
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium leading-snug">{name}</p>
                    {isOnBreak ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-amber-400/40 bg-amber-400/15 text-amber-950 dark:text-amber-100"
                      >
                        {STAFF_PRESENCE_STATUS_LABELS.on_break}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.position_name ? `${member.position_name} · ` : ""}
                    {presenceLabel(member, timeFmt)}
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
