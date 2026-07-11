"use client";

import type { RestaurantStaffRow, StaffLivePresenceRow } from "@/lib/types/staff";
import { staffDisplayName, STAFF_WORK_ENTRY_COLORS } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

type StaffLivePresenceNameChipsProps = {
  presence: StaffLivePresenceRow[];
  staffById: ReadonlyMap<string, RestaurantStaffRow>;
  mode: "working" | "on_break";
  className?: string;
};

export function StaffLivePresenceNameChips({
  presence,
  staffById,
  mode,
  className,
}: StaffLivePresenceNameChipsProps) {
  const members = presence
    .filter((row) => row.status === mode)
    .map((row) => staffById.get(row.staff_id))
    .filter(Boolean);

  if (members.length === 0) return null;

  const isWorking = mode === "working";

  return (
    <ul className={cn("flex flex-wrap gap-1", className)}>
      {members.map((member) => (
        <li
          key={member!.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            isWorking
              ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"
              : "border-amber-400/35 bg-amber-400/12 text-amber-900 dark:text-amber-200",
          )}
        >
          <span
            className="size-1.5 rounded-full"
            style={{
              backgroundColor: isWorking
                ? STAFF_WORK_ENTRY_COLORS.work
                : STAFF_WORK_ENTRY_COLORS.break,
            }}
            aria-hidden
          />
          {staffDisplayName(member!)}
        </li>
      ))}
    </ul>
  );
}
